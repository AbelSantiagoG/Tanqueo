import { NextRequest, NextResponse } from "next/server"
import { adminPhone, authenticatedNotificationClient, sendWhatsApp } from "@/app/api/notifications/_lib/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { role } = await authenticatedNotificationClient(request)
    if (!["admin", "despachador"].includes(role)) throw new Error("Solo administradores y despachadores pueden probar notificaciones.")

    const result = await sendWhatsApp({
      phone: adminPhone(),
      orderNumber: "PRUEBA",
      body: "Prueba ASUCAP: la conexion con Twilio WhatsApp funciona correctamente.",
      contentVariables: { "1": "Prueba ASUCAP" },
    })
    return NextResponse.json({
      channel: "whatsapp",
      message: "Mensaje de prueba aceptado por Twilio.",
      sid: result.sid,
      status: result.status,
    })
  } catch (error: any) {
    console.error("[notifications] Fallo la prueba de WhatsApp", { message: error.message })
    return NextResponse.json({ error: error.message || "No se pudo enviar el mensaje de prueba." }, { status: 400 })
  }
}
