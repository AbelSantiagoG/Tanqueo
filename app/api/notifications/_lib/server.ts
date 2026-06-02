import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

export type NotificationChannel = "whatsapp" | "correo" | "sms" | "sin_configurar"
export type OrderNotificationEvent = "cerrada" | "ejecutada"

interface TwilioMessageResponse {
  sid?: string
  status?: string
  code?: number
  message?: string
  more_info?: string
  moreInfo?: string
}

interface AdminNotificationInput {
  orderId: string
  orderNumber: string
  event: OrderNotificationEvent
  operatorName?: string | null
  plate?: string | null
  gallons?: number | null
  date?: string | null
  phone?: string | null
  email?: string | null
}

function env(name: string) {
  return process.env[name]?.trim() || ""
}

function requiredEnv(name: string) {
  const value = env(name)
  if (!value) throw new Error(`Falta ${name} en .env.local. Reinicia npm run dev despues de configurarla.`)
  return value
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function normalizePhone(value: string, variableName: string) {
  const phone = value.trim().replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "")
  if (!/^\+\d{8,15}$/.test(phone)) {
    throw new Error(`${variableName} debe usar formato internacional, por ejemplo +573001234567.`)
  }
  return phone
}

function whatsappAddress(value: string, variableName: string) {
  return `whatsapp:${normalizePhone(value, variableName)}`
}

function twilioCredentials() {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID")
  const apiKey = env("TWILIO_API_KEY")
  const apiKeySecret = env("TWILIO_API_KEY_SECRET")

  if (Boolean(apiKey) !== Boolean(apiKeySecret)) {
    throw new Error("Configura TWILIO_API_KEY y TWILIO_API_KEY_SECRET juntos o deja ambos vacios.")
  }

  if (apiKey && apiKeySecret) {
    return { accountSid, username: apiKey, password: apiKeySecret, mode: "api_key" }
  }

  return { accountSid, username: accountSid, password: requiredEnv("TWILIO_AUTH_TOKEN"), mode: "auth_token" }
}

async function twilioMessage(input: {
  channel: "WhatsApp" | "SMS"
  from: string
  to: string
  body: string
  orderNumber: string
  contentSid?: string
  contentVariables?: Record<string, string>
}) {
  const credentials = twilioCredentials()
  const form = new URLSearchParams({ From: input.from, To: input.to })

  if (input.contentSid) {
    form.set("ContentSid", input.contentSid)
    if (input.contentVariables) form.set("ContentVariables", JSON.stringify(input.contentVariables))
  } else {
    form.set("Body", input.body)
  }

  console.info(`[notifications] Intentando enviar ${input.channel}`, {
    from: input.from,
    to: input.to,
    orderNumber: input.orderNumber,
    authMode: credentials.mode,
    contentMode: input.contentSid ? "template" : "body",
  })

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  })
  const rawBody = await response.text()
  let body: TwilioMessageResponse = {}
  try {
    body = rawBody ? JSON.parse(rawBody) as TwilioMessageResponse : {}
  } catch {
    body = { message: rawBody }
  }

  if (!response.ok) {
    const details = {
      status: response.status,
      code: body.code,
      message: body.message || "Twilio no pudo enviar el mensaje.",
      moreInfo: body.more_info || body.moreInfo,
    }
    console.error(`[notifications] Error enviando ${input.channel}`, details)
    throw new Error(`Twilio ${input.channel} fallo: ${details.message}${details.code ? ` (codigo ${details.code})` : ""}`)
  }

  console.info(`[notifications] ${input.channel} aceptado por Twilio`, {
    sid: body.sid,
    status: body.status,
    orderNumber: input.orderNumber,
  })
  return { sid: body.sid, status: body.status }
}

export async function sendWhatsApp(input: {
  phone: string
  body: string
  orderNumber: string
  contentVariables?: Record<string, string>
}) {
  const from = whatsappAddress(requiredEnv("TWILIO_WHATSAPP_FROM"), "TWILIO_WHATSAPP_FROM")
  const to = whatsappAddress(input.phone, "ADMIN_NOTIFICATION_PHONE")
  const contentSid = env("TWILIO_WHATSAPP_CONTENT_SID")

  if (contentSid && !/^HX[a-f\d]{32}$/i.test(contentSid)) {
    throw new Error("TWILIO_WHATSAPP_CONTENT_SID debe ser un SID de contenido valido que comience por HX.")
  }

  return twilioMessage({
    channel: "WhatsApp",
    from,
    to,
    body: input.body,
    orderNumber: input.orderNumber,
    contentSid: contentSid || undefined,
    contentVariables: contentSid ? input.contentVariables : undefined,
  })
}

async function sendSms(input: { phone: string; body: string; orderNumber: string }) {
  return twilioMessage({
    channel: "SMS",
    from: normalizePhone(requiredEnv("TWILIO_SMS_FROM"), "TWILIO_SMS_FROM"),
    to: normalizePhone(input.phone, "ADMIN_NOTIFICATION_PHONE"),
    body: input.body,
    orderNumber: input.orderNumber,
  })
}

async function sendEmail(input: { email: string; subject: string; text: string; orderId: string; event: OrderNotificationEvent }) {
  const apiKey = requiredEnv("RESEND_API_KEY")
  const from = requiredEnv("RESEND_FROM")
  console.info("[notifications] Intentando enviar correo", { to: input.email, orderId: input.orderId })
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `orden-${input.event}-${input.orderId}`,
      "User-Agent": "ASUCAP-Control-Tanqueo/1.0",
    },
    body: JSON.stringify({ from, to: [input.email], subject: input.subject, text: input.text }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || "Resend no pudo enviar el correo.")
  console.info("[notifications] Correo aceptado por Resend", { id: body.id, orderId: input.orderId })
}

function formatDate(value?: string | null) {
  if (!value) return new Date().toLocaleDateString("es-CO")
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-CO")
}

function buildOrderMessage(input: AdminNotificationInput) {
  const gallons = input.gallons === null || input.gallons === undefined
    ? "sin registrar"
    : Number(input.gallons).toLocaleString("es-CO", { maximumFractionDigits: 2 })
  return `ASUCAP Tanqueo: la orden ${input.orderNumber} fue ${input.event}. Operario: ${input.operatorName || "sin registrar"}. Moto: ${input.plate || "sin registrar"}. Galones: ${gallons}. Fecha: ${formatDate(input.date)}.`
}

export async function notifyAdmin(input: AdminNotificationInput): Promise<{ channel: NotificationChannel; message: string }> {
  const phone = input.phone?.trim() || ""
  const email = input.email?.trim() || ""
  const body = buildOrderMessage(input)
  const errors: string[] = []
  const contentVariables = {
    "1": input.orderNumber,
    "2": input.operatorName || "sin registrar",
    "3": input.plate || "sin registrar",
    "4": input.gallons === null || input.gallons === undefined ? "sin registrar" : String(input.gallons),
    "5": formatDate(input.date),
  }

  if (phone) {
    try {
      await sendWhatsApp({ phone, body, orderNumber: input.orderNumber, contentVariables })
      return { channel: "whatsapp", message: `Orden ${input.event} y administrador notificado por WhatsApp.` }
    } catch (error) {
      errors.push(`WhatsApp: ${errorMessage(error)}`)
    }
  } else {
    errors.push("WhatsApp: falta ADMIN_NOTIFICATION_PHONE o el telefono de la empresa.")
  }

  if (email && env("RESEND_API_KEY")) {
    try {
      await sendEmail({ email, subject: `Orden ${input.orderNumber} ${input.event}`, text: body, orderId: input.orderId, event: input.event })
      return { channel: "correo", message: `Orden ${input.event} y administrador notificado por correo.` }
    } catch (error) {
      errors.push(`Correo: ${errorMessage(error)}`)
    }
  }

  if (phone && env("TWILIO_SMS_FROM")) {
    try {
      await sendSms({ phone, body, orderNumber: input.orderNumber })
      return { channel: "sms", message: `Orden ${input.event} y administrador notificado por SMS.` }
    } catch (error) {
      errors.push(`SMS: ${errorMessage(error)}`)
    }
  }

  return {
    channel: "sin_configurar",
    message: `La orden quedo ${input.event}, pero no se pudo avisar al administrador. ${errors.join(" | ")}`,
  }
}

export async function authenticatedNotificationClient(request: NextRequest) {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) throw new Error("Sesion requerida.")

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error("Sesion invalida.")
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single()
  if (profileError || !profile) throw new Error("No se encontro el perfil autenticado.")
  return { supabase, user: data.user, role: profile.role as string }
}

export function adminPhone() {
  return requiredEnv("ADMIN_NOTIFICATION_PHONE")
}
