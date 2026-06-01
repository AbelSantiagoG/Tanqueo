import type { FuelOrder, OrderStatus } from "@/lib/types"

export const BRAND_YIELDS: Record<string, number> = {
  Honda: 55,
  Yamaha: 52,
  Suzuki: 50,
  AKT: 48,
  Bajaj: 53,
  TVS: 50,
  "Royal Enfield": 40,
  KTM: 45,
  Otra: 50,
}

export const VEHICLE_BRANDS = Object.keys(BRAND_YIELDS)

export const FUEL_LEVELS = [
  { label: "Vacio (E)", val: 10, color: "text-red-500", border: "border-red-500" },
  { label: "Cuarto (1/4)", val: 28, color: "text-orange-500", border: "border-orange-500" },
  { label: "Medio (1/2)", val: 50, color: "text-yellow-500", border: "border-yellow-500" },
  { label: "Tres cuartos (3/4)", val: 75, color: "text-green-500", border: "border-green-500" },
  { label: "Lleno (F)", val: 100, color: "text-emerald-600", border: "border-emerald-600" },
]

export function todayIso() {
  return new Date().toISOString().split("T")[0]
}

export function effectiveOrderStatus(order: Pick<FuelOrder, "estado" | "fecha_vencimiento">): OrderStatus {
  if (order.estado === "pendiente" && order.fecha_vencimiento < todayIso()) return "vencida"
  return order.estado
}

export function formatCurrency(value?: number | null) {
  return `$${Number(value || 0).toLocaleString("es-CO")} COP`
}

export function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO")
}
