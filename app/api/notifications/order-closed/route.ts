import { NextRequest, NextResponse } from "next/server"
import { authenticatedNotificationClient, notifyAdmin, type OrderNotificationEvent } from "@/app/api/notifications/_lib/server"

export const runtime = "nodejs"

interface NotifiableOrder {
  id: string
  num: string
  estado: string
  operator_id: string
  galones?: number | null
  fecha_ejecucion?: string | null
  updated_at?: string | null
  vehicles?: { placa?: string | null } | null
  profiles?: { full_name?: string | null } | null
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, role } = await authenticatedNotificationClient(request)
    const body = await request.json() as { orderId?: string }
    if (!body.orderId) throw new Error("Falta la orden que se debe notificar.")

    const [{ data: orderData, error: orderError }, { data: settings }] = await Promise.all([
      supabase
        .from("fuel_orders")
        .select("id, num, estado, operator_id, galones, fecha_ejecucion, updated_at, vehicles:vehicle_id(placa), profiles:operator_id(full_name)")
        .eq("id", body.orderId)
        .single(),
      supabase.from("company_settings").select("emp_email, emp_tel").limit(1).maybeSingle(),
    ])
    if (orderError || !orderData) throw new Error("No se encontro la orden.")

    const order = orderData as unknown as NotifiableOrder
    if (order.estado !== "cerrada" && order.estado !== "ejecutada") {
      throw new Error("La orden debe estar cerrada o ejecutada antes de notificar.")
    }
    if (!["admin", "despachador"].includes(role) && !(role === "operario" && order.operator_id === user.id)) {
      throw new Error("No tienes permiso para notificar esta orden.")
    }

    const result = await notifyAdmin({
      orderId: order.id,
      orderNumber: order.num,
      event: order.estado as OrderNotificationEvent,
      operatorName: order.profiles?.full_name,
      plate: order.vehicles?.placa,
      gallons: order.galones,
      date: order.fecha_ejecucion || order.updated_at,
      phone: process.env.ADMIN_NOTIFICATION_PHONE || settings?.emp_tel,
      email: process.env.ADMIN_NOTIFICATION_EMAIL || settings?.emp_email,
    })

    if (result.channel === "sin_configurar") {
      return NextResponse.json({ ...result, error: result.message }, { status: 502 })
    }
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[notifications] No se pudo procesar el aviso de orden", { message: error.message })
    return NextResponse.json({ error: error.message || "No se pudo notificar la orden." }, { status: 400 })
  }
}
