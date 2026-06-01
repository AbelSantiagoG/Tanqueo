import { AlertTriangle } from "lucide-react"
import { STATION_SCHEMA_MESSAGE } from "@/lib/schema-capabilities"

export function SchemaUpdateAlert() {
  return <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>{STATION_SCHEMA_MESSAGE}</p></div>
}
