import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || ""
const twilioUsername = process.env.TWILIO_API_KEY || twilioAccountSid
const twilioPassword = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN || ""

interface ClosedOrder {
  id: string
  num: string
  estado: string
  galones?: number | null
  valor_total?: number | null
  vehicles?: { placa?: string | null } | null
  profiles?: { full_name?: string | null } | null
  station?: { nombre?: string | null } | null
}

function normalizePhone(value: string) {
  const phone = value.trim().replace(/[^\d+]/g, "")
  if (!phone.startsWith("+")) throw new Error("El telefono de notificacion debe usar formato internacional, por ejemplo +573001234567.")
  return phone
}

async function authenticatedClient(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Falta la configuracion de Supabase en el servidor.")
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) throw new Error("Sesion requerida.")

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error("Sesion invalida.")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
  if (!profile || !["admin", "despachador"].includes(profile.role)) throw new Error("No tienes permiso para notificar cierres.")
  return supabase
}

async function sendTwilioMessage(input: { from: string; to: string; body: string; contentSid?: string }) {
  if (!twilioAccountSid || !twilioUsername || !twilioPassword) throw new Error("Faltan credenciales de Twilio.")
  const form = new URLSearchParams({ From: input.from, To: input.to })
  if (input.contentSid) {
    form.set("ContentSid", input.contentSid)
  } else {
    form.set("Body", input.body)
  }
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioUsername}:${twilioPassword}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || "Twilio no pudo enviar el mensaje.")
}

async function sendEmail(input: { to: string; subject: string; text: string; orderId: string }) {
  const apiKey = process.env.RESEND_API_KEY || ""
  const from = process.env.RESEND_FROM || ""
  if (!apiKey || !from) throw new Error("Faltan credenciales de Resend.")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `orden-cerrada-${input.orderId}`,
      "User-Agent": "ASUCAP-Control-Tanqueo/1.0",
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || "Resend no pudo enviar el correo.")
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await authenticatedClient(request)
    const body = await request.json() as { orderId?: string }
    if (!body.orderId) throw new Error("Falta la orden que se debe notificar.")

    const [{ data: orderData, error: orderError }, { data: settings }] = await Promise.all([
      supabase
        .from("fuel_orders")
        .select("id, num, estado, galones, valor_total, vehicles:vehicle_id(placa), profiles:operator_id(full_name), station:station_id(nombre)")
        .eq("id", body.orderId)
        .single(),
      supabase.from("company_settings").select("emp_email, emp_tel").limit(1).maybeSingle(),
    ])
    if (orderError || !orderData) throw new Error("No se encontro la orden.")
    const order = orderData as unknown as ClosedOrder
    if (order.estado !== "cerrada") throw new Error("La orden todavia no esta cerrada.")

    const phone = process.env.ADMIN_NOTIFICATION_PHONE || settings?.emp_tel || ""
    const email = process.env.ADMIN_NOTIFICATION_EMAIL || settings?.emp_email || ""
    const message = [
      `La orden ${order.num} quedo cerrada.`,
      `Operario: ${order.profiles?.full_name || "Sin registrar"}.`,
      `Moto: ${order.vehicles?.placa || "Sin registrar"}.`,
      `Estacion: ${order.station?.nombre || "Sin registrar"}.`,
      order.galones ? `Galones: ${Number(order.galones).toLocaleString("es-CO", { maximumFractionDigits: 2 })}.` : "",
    ].filter(Boolean).join(" ")
    const errors: string[] = []

    if (phone && process.env.TWILIO_WHATSAPP_FROM && twilioAccountSid && twilioPassword) {
      try {
        await sendTwilioMessage({
          from: process.env.TWILIO_WHATSAPP_FROM,
          to: `whatsapp:${normalizePhone(phone)}`,
          body: message,
          contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID,
        })
        return NextResponse.json({ channel: "whatsapp", message: "Orden cerrada y administrador notificado por WhatsApp." })
      } catch (error: any) {
        errors.push(`WhatsApp: ${error.message}`)
      }
    }

    if (email && process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      try {
        await sendEmail({ to: email, subject: `Orden ${order.num} cerrada`, text: message, orderId: order.id })
        return NextResponse.json({ channel: "correo", message: "Orden cerrada y administrador notificado por correo." })
      } catch (error: any) {
        errors.push(`Correo: ${error.message}`)
      }
    }

    if (phone && process.env.TWILIO_SMS_FROM && twilioAccountSid && twilioPassword) {
      try {
        await sendTwilioMessage({ from: process.env.TWILIO_SMS_FROM, to: normalizePhone(phone), body: message })
        return NextResponse.json({ channel: "sms", message: "Orden cerrada y administrador notificado por SMS." })
      } catch (error: any) {
        errors.push(`SMS: ${error.message}`)
      }
    }

    return NextResponse.json({
      channel: "sin_configurar",
      message: errors.length
        ? `La orden se cerro, pero fallaron los canales configurados: ${errors.join(" | ")}`
        : "Orden cerrada. Configura WhatsApp, correo o SMS para avisar automaticamente al administrador.",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No se pudo notificar el cierre." }, { status: 400 })
  }
}
