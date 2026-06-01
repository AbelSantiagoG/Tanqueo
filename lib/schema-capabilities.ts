let stationSchemaPromise: Promise<boolean> | null = null

export const STATION_SCHEMA_MESSAGE = "Supabase esta pendiente de actualizacion. Ejecuta supabase/migrations/202606010001_full_fuel_control.sql en el SQL Editor y recarga la pagina."

export function hasStationSchema() {
  if (!stationSchemaPromise) {
    stationSchemaPromise = fetch("/api/schema", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("No fue posible validar el esquema de Supabase.")
        const data = await response.json() as { stationSchemaReady?: boolean }
        return data.stationSchemaReady === true
      })
      .then((ready) => {
        if (!ready) stationSchemaPromise = null
        return ready
      })
      .catch(() => {
        stationSchemaPromise = null
        return false
      })
  }
  return stationSchemaPromise
}
