import { supabase } from "@/lib/supabase"
import type { PhotoType, UploadedEvidence } from "@/lib/types"

const BUCKET = "evidencias-tanqueo"

function dataUrlToBlob(dataUrl: string) {
  const [header, payload] = dataUrl.split(",")
  const mime = header.match(/data:(.*?);/)?.[1] || "image/jpeg"
  const bytes = atob(payload)
  const values = new Uint8Array(bytes.length)
  for (let index = 0; index < bytes.length; index += 1) values[index] = bytes.charCodeAt(index)
  return new Blob([values], { type: mime })
}

export async function uploadEvidence(
  userId: string,
  orderId: string,
  type: PhotoType,
  dataUrl: string,
): Promise<UploadedEvidence> {
  const path = `${userId}/${orderId}/${type}-${crypto.randomUUID()}.jpg`
  const blob = dataUrlToBlob(dataUrl)
  if (blob.size > 5 * 1024 * 1024) throw new Error("La imagen supera el limite de 5 MB")

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function removeEvidence(paths: string[]) {
  if (!paths.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.warn("No se pudieron limpiar evidencias sin asociar:", error)
}
