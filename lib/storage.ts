import { supabase } from "@/lib/supabase"
import type { PhotoType, UploadedEvidence } from "@/lib/types"

async function sessionHeaders() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error("Inicia sesion nuevamente para subir evidencias.")
  return {
    Authorization: `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
  }
}

async function responseJson(response: Response) {
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || "No se pudo procesar la evidencia.")
  return body
}

export async function uploadEvidence(
  orderId: string,
  type: PhotoType,
  dataUrl: string,
): Promise<UploadedEvidence> {
  const response = await fetch("/api/evidence", {
    method: "POST",
    headers: await sessionHeaders(),
    body: JSON.stringify({ orderId, type, dataUrl }),
  })
  return responseJson(response)
}

export async function removeEvidence(paths: string[]) {
  if (!paths.length) return
  try {
    const response = await fetch("/api/evidence", {
      method: "DELETE",
      headers: await sessionHeaders(),
      body: JSON.stringify({ paths }),
    })
    await responseJson(response)
  } catch (error) {
    console.warn("No se pudieron limpiar evidencias sin asociar:", error)
  }
}
