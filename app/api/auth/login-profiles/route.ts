import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const VALID_ROLES = new Set(["operario", "despachador"])

function env(name: string) {
  return process.env[name]?.trim() || ""
}

function requiredEnv(name: string) {
  const value = env(name)
  if (!value) throw new Error(`Configura ${name} en el servidor.`)
  return value
}

function cleanSearch(value: string | null) {
  return (value || "").trim().replace(/\s+/g, " ").slice(0, 80)
}

function likePattern(value: string) {
  return `%${value.replace(/[%_]/g, (match) => `\\${match}`)}%`
}

export async function GET(request: NextRequest) {
  try {
    const role = cleanSearch(request.nextUrl.searchParams.get("role"))
    const search = cleanSearch(request.nextUrl.searchParams.get("search"))
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 10), 80)

    if (!VALID_ROLES.has(role)) throw new Error("Rol de ingreso invalido.")

    const admin = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    })

    let query = admin
      .from("profiles")
      .select("id, full_name, role, cargo")
      .eq("role", role)
      .eq("activo", true)
      .order("full_name", { ascending: true })
      .limit(limit + 1)

    if (search) query = query.ilike("full_name", likePattern(search))

    const { data, error } = await query
    if (error) throw error

    const rows = data || []
    return NextResponse.json(
      { profiles: rows.slice(0, limit), hasMore: rows.length > limit },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "No fue posible cargar usuarios." }, { status: 400 })
  }
}
