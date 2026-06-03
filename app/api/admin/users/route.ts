import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Profile, UserRole } from "@/lib/types"

export const runtime = "nodejs"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || ""
const apiKey = process.env.CLOUDINARY_API_KEY || ""
const apiSecret = process.env.CLOUDINARY_API_SECRET || ""
const folder = (process.env.CLOUDINARY_FOLDER || "tanqueo/evidencias").replace(/^\/+|\/+$/g, "")

function signature(params: Record<string, string | number>) {
  const values = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  return createHash("sha1").update(`${values}${apiSecret}`).digest("hex")
}

async function deleteCloudinaryEvidence(paths: string[]) {
  const validPaths = paths.filter((path) => typeof path === "string" && path.startsWith(`${folder}/`))
  if (!validPaths.length || !cloudName || !apiKey || !apiSecret) return

  await Promise.all(validPaths.map(async (publicId) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const form = new FormData()
    form.set("api_key", apiKey)
    form.set("public_id", publicId)
    form.set("timestamp", String(timestamp))
    form.set("signature", signature({ public_id: publicId, timestamp }))

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: "POST",
        body: form,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        console.warn("Cloudinary no pudo eliminar una evidencia.", body?.error?.message || response.statusText)
      }
    } catch (error) {
      console.warn("Cloudinary no pudo eliminar una evidencia.", error)
    }
  }))
}

async function adminClientFor(request: NextRequest) {
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Configura SUPABASE_SERVICE_ROLE_KEY en el servidor para administrar cuentas.")
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) throw new Error("Sesion requerida.")

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) throw new Error("Sesion invalida.")

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", data.user.id).single()
  if (profileError || profile?.role !== "admin") throw new Error("Solo un administrador puede gestionar cuentas.")
  return { admin, userClient, userId: data.user.id }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await adminClientFor(request)
    const body = await request.json() as Profile & { password?: string }
    if (!body.email || !body.password || !body.full_name || !body.role) throw new Error("Nombre, rol, correo y contrasena temporal son obligatorios.")
    if (!["operario", "despachador", "admin"].includes(body.role)) throw new Error("Rol invalido.")

    const { data, error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, role: body.role },
    })
    if (error || !data.user) throw error || new Error("No se pudo crear la cuenta.")

    const profile: Profile = {
      id: data.user.id,
      full_name: body.full_name,
      role: body.role as UserRole,
      email: body.email,
      cedula: body.cedula,
      telefono: body.telefono,
      cargo: body.cargo,
      zona: body.zona,
      observaciones: body.observaciones,
      activo: true,
    }
    const { error: profileError } = await admin.from("profiles").upsert(profile)
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id)
      throw profileError
    }
    return NextResponse.json({ profile })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No se pudo crear la cuenta." }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin, userClient } = await adminClientFor(request)
    const searchParams = new URL(request.url).searchParams
    const id = searchParams.get("id")
    const mode = searchParams.get("mode") || "deactivate"
    if (!id) throw new Error("Falta el ID de la cuenta.")
    if (!["deactivate", "delete"].includes(mode)) throw new Error("Accion de cuenta invalida.")

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, role, activo")
      .eq("id", id)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) throw new Error("No se encontro la cuenta.")

    if (mode === "delete" && target.role === "admin") {
      const { data: firstAdmin, error: firstAdminError } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle()
      if (firstAdminError) throw firstAdminError
      if (firstAdmin?.id === id) {
        throw new Error("El primer administrador no se puede eliminar.")
      }
    }

    if (mode === "delete") {
      const { data: paths, error: deleteError } = await userClient.rpc("hard_delete_profile", { p_profile_id: id })
      if (deleteError) throw deleteError

      const { error: authError } = await admin.auth.admin.deleteUser(id)
      if (authError && !/not found/i.test(authError.message)) throw authError

      await deleteCloudinaryEvidence(Array.isArray(paths) ? paths : [])
      return NextResponse.json({ ok: true, mode })
    }

    const { error } = await admin
      .from("profiles")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error

    return NextResponse.json({ ok: true, mode })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No se pudo actualizar la cuenta." }, { status: 400 })
  }
}
