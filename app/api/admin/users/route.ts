import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Profile, UserRole } from "@/lib/types"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

async function adminClientFor(request: NextRequest) {
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Configura SUPABASE_SERVICE_ROLE_KEY en el servidor para administrar cuentas.")
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) throw new Error("Sesion requerida.")

  const authClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) throw new Error("Sesion invalida.")

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", data.user.id).single()
  if (profileError || profile?.role !== "admin") throw new Error("Solo un administrador puede gestionar cuentas.")
  return admin
}

export async function POST(request: NextRequest) {
  try {
    const admin = await adminClientFor(request)
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
    const admin = await adminClientFor(request)
    const id = new URL(request.url).searchParams.get("id")
    if (!id) throw new Error("Falta el ID de la cuenta.")
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No se pudo eliminar la cuenta." }, { status: 400 })
  }
}
