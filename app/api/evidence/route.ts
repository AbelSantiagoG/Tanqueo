import { createHash, randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { PhotoType } from "@/lib/types"

export const runtime = "nodejs"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ""
const apiKey = process.env.CLOUDINARY_API_KEY || ""
const apiSecret = process.env.CLOUDINARY_API_SECRET || ""
const folder = (process.env.CLOUDINARY_FOLDER || "tanqueo/evidencias").replace(/^\/+|\/+$/g, "")
const photoTypes: PhotoType[] = ["tablero", "factura"]

function cloudinaryConfig() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Falta la configuracion de Supabase en el servidor.")
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env.local.")
  }
}

function signature(params: Record<string, string | number>) {
  const values = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  return createHash("sha1").update(`${values}${apiSecret}`).digest("hex")
}

async function authenticatedClient(request: NextRequest) {
  cloudinaryConfig()
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) throw new Error("Sesion requerida.")

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error("Sesion invalida.")
  return { supabase, user: data.user }
}

async function cloudinaryRequest(action: "upload" | "destroy", form: FormData) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/${action}`, {
    method: "POST",
    body: form,
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || "Cloudinary no pudo procesar la imagen.")
  return body
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient(request)
    const body = await request.json() as { orderId?: string; type?: PhotoType; dataUrl?: string }
    if (!body.orderId || !/^[0-9a-f-]{36}$/i.test(body.orderId)) throw new Error("Orden invalida.")
    if (!body.type || !photoTypes.includes(body.type)) throw new Error("Tipo de evidencia invalido.")
    if (!body.dataUrl || !/^data:image\/(jpeg|png|webp);base64,/i.test(body.dataUrl)) throw new Error("Imagen invalida.")

    const payload = body.dataUrl.split(",")[1] || ""
    if (Buffer.byteLength(payload, "base64") > 5 * 1024 * 1024) throw new Error("La imagen supera el limite de 5 MB.")

    const { data: order, error } = await supabase
      .from("fuel_orders")
      .select("operator_id")
      .eq("id", body.orderId)
      .eq("operator_id", user.id)
      .maybeSingle()
    if (error || !order) throw new Error("La orden no pertenece al operario autenticado.")

    const publicId = `${folder}/${user.id}/${body.orderId}/${body.type}-${randomUUID()}`
    const timestamp = Math.floor(Date.now() / 1000)
    const form = new FormData()
    form.set("file", body.dataUrl)
    form.set("api_key", apiKey)
    form.set("public_id", publicId)
    form.set("timestamp", String(timestamp))
    form.set("signature", signature({ public_id: publicId, timestamp }))
    const uploaded = await cloudinaryRequest("upload", form)
    return NextResponse.json({ path: uploaded.public_id, url: uploaded.secure_url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No se pudo subir la evidencia." }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await authenticatedClient(request)
    const body = await request.json() as { paths?: string[] }
    if (!Array.isArray(body.paths)) throw new Error("Lista de evidencias invalida.")
    const paths = body.paths.filter((path) => typeof path === "string" && path.startsWith(`${folder}/`))
    if (!paths.length) return NextResponse.json({ ok: true })

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (profile?.role !== "admin" && paths.some((path) => !path.startsWith(`${folder}/${user.id}/`))) {
      throw new Error("No tienes permiso para eliminar estas evidencias.")
    }

    await Promise.all(paths.map(async (publicId) => {
      const timestamp = Math.floor(Date.now() / 1000)
      const form = new FormData()
      form.set("api_key", apiKey)
      form.set("public_id", publicId)
      form.set("timestamp", String(timestamp))
      form.set("signature", signature({ public_id: publicId, timestamp }))
      await cloudinaryRequest("destroy", form)
    }))
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No se pudieron eliminar las evidencias." }, { status: 400 })
  }
}
