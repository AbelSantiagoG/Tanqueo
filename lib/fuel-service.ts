import { supabase } from "@/lib/supabase"
import type { FuelOrder, FuelRecord, UploadedEvidence } from "@/lib/types"
import { hasStationSchema, STATION_SCHEMA_MESSAGE } from "@/lib/schema-capabilities"

export async function expireFuelOrders() {
  const { error } = await supabase.rpc("expire_fuel_orders")
  if (error) throw error
}

export async function createFuelOrder(input: {
  operatorId: string
  vehicleId: string
  stationId: string
  issueDate: string
  expiryDate: string
  notes?: string
}) {
  if (!await hasStationSchema()) throw new Error(STATION_SCHEMA_MESSAGE)
  const { data, error } = await supabase
    .rpc("create_fuel_order", {
      p_operator_id: input.operatorId,
      p_vehicle_id: input.vehicleId,
      p_station_id: input.stationId,
      p_fecha_emision: input.issueDate,
      p_fecha_vencimiento: input.expiryDate,
      p_observaciones: input.notes || null,
    })
    .single()
  if (error) throw error
  return data as FuelOrder
}

export async function updateFuelOrder(input: {
  orderId: string
  operatorId: string
  vehicleId: string
  stationId: string
  issueDate: string
  expiryDate: string
  notes?: string
}) {
  const { data, error } = await supabase
    .rpc("update_fuel_order", {
      p_order_id: input.orderId,
      p_operator_id: input.operatorId,
      p_vehicle_id: input.vehicleId,
      p_station_id: input.stationId,
      p_fecha_emision: input.issueDate,
      p_fecha_vencimiento: input.expiryDate,
      p_observaciones: input.notes || null,
    })
    .single()
  if (error) throw error
  return data as FuelOrder
}

export async function executeFuelOrder(input: {
  orderId: string
  date: string
  mileage: number
  gallons: number
  invoiceValue: number
  fuelLevel: string
  fuelLevelPercentage: number
  notes?: string
  gps: { lat: number; lng: number; accuracy: number }
  evidence: {
    tablero: UploadedEvidence
    nivel_tanque: UploadedEvidence
    factura: UploadedEvidence
  }
}) {
  const { data, error } = await supabase
    .rpc("execute_fuel_order", {
      p_order_id: input.orderId,
      p_fecha: input.date,
      p_kilometraje_actual: input.mileage,
      p_galones: input.gallons,
      p_valor_total: input.invoiceValue,
      p_nivel_tanque: input.fuelLevel,
      p_nivel_tanque_porcentaje: input.fuelLevelPercentage,
      p_observaciones: input.notes || null,
      p_gps_lat: input.gps.lat,
      p_gps_lng: input.gps.lng,
      p_gps_precision: input.gps.accuracy,
      p_photo_tablero_url: input.evidence.tablero.url,
      p_photo_tablero_path: input.evidence.tablero.path,
      p_photo_nivel_tanque_url: input.evidence.nivel_tanque.url,
      p_photo_nivel_tanque_path: input.evidence.nivel_tanque.path,
      p_photo_factura_url: input.evidence.factura.url,
      p_photo_factura_path: input.evidence.factura.path,
    })
    .single()
  if (error) throw error
  return data as FuelRecord
}

export async function loadFuelRecords(operatorId?: string, options: { includePhotos?: boolean; stationSchemaReady?: boolean } = {}) {
  const stationSchemaReady = options.stationSchemaReady ?? await hasStationSchema()
  const stationSelect = stationSchemaReady ? ", fuel_orders(*, station:station_id(*)), station:station_id(*)" : ", fuel_orders(*)"
  const photosSelect = options.includePhotos ? ", order_photos(*)" : ""
  const recordSelect: string = `*${stationSelect}, profiles:operator_id(*), vehicles(*), despachador:despachador_id(*)${photosSelect}`
  let query = supabase
    .from("fuel_records")
    .select(recordSelect)
    .order("created_at", { ascending: false })
  if (operatorId) query = query.eq("operator_id", operatorId)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as unknown as FuelRecord[]
}
