import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function GET() {
  if (!url || !anonKey) {
    return NextResponse.json({ stationSchemaReady: false }, { headers: { "Cache-Control": "no-store" } })
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } })
  const [stations, orders, records] = await Promise.all([
    supabase.from("service_stations").select("id").limit(1),
    supabase.from("fuel_orders").select("station_id").limit(1),
    supabase.from("fuel_records").select("station_id").limit(1),
  ])

  return NextResponse.json(
    {
      stationSchemaReady: !stations.error
        && !orders.error
        && !records.error,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
