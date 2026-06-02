import { supabase } from "@/lib/supabase"

export async function notifyClosedOrder(orderId: string) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error("Inicia sesion nuevamente para enviar la notificacion.")

  const response = await fetch("/api/notifications/order-closed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "No se pudo notificar el cierre.")
  return body as { channel: "whatsapp" | "correo" | "sms" | "sin_configurar"; message: string }
}
