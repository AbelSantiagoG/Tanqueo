import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function POST(request: NextRequest) {
  try {
    if (!url || !anonKey || !serviceRoleKey) {
      throw new Error("Configura SUPABASE_SERVICE_ROLE_KEY en el servidor para iniciar sesion por perfil.")
    }
    const body = await request.json() as { profileId?: string; password?: string }
    if (!body.profileId || !body.password) throw new Error("Selecciona tu usuario e ingresa la contrasena.")

    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, role, activo")
      .eq("id", body.profileId)
      .single()
    if (profileError || !profile?.email || profile.activo === false || !["operario", "despachador"].includes(profile.role)) {
      throw new Error("El perfil seleccionado no esta disponible.")
    }

    const auth = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await auth.auth.signInWithPassword({ email: profile.email, password: body.password })
    if (error || !data.user || !data.session) throw new Error("Credenciales incorrectas.")
    if (data.user.id !== profile.id) throw new Error("Las credenciales no corresponden al perfil seleccionado.")

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No fue posible iniciar sesion." }, { status: 400 })
  }
}
