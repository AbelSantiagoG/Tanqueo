export type UserRole = "operario" | "despachador" | "admin"
export type OrderStatus = "pendiente" | "vencida" | "ejecutada" | "verificado" | "observacion" | "cerrada"
export type PhotoType = "tablero" | "factura"

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  email?: string | null
  cedula?: string | null
  telefono?: string | null
  cargo?: string | null
  zona?: string | null
  observaciones?: string | null
  activo?: boolean
  created_at?: string
}

export interface Vehicle {
  id: string
  placa: string
  marca: string
  tipo: string
  modelo?: string | null
  anio?: string | null
  color?: string | null
  capacidad_tanque: number
  rendimiento_esperado: number
  operario_asignado_id?: string | null
  kilometraje_inicial: number
  activo?: boolean
  profiles?: Profile
  created_at?: string
}

export interface CompanySettings {
  id: string
  emp_nombre: string
  emp_nit: string
  emp_dir: string
  emp_tel: string
  emp_email: string
  emp_ciudad: string
  emp_logo: string
  prefix: string
  dias_venc: number
  alert_pct: number
}

export interface ServiceStation {
  id: string
  nombre: string
  nit: string
  direccion: string
  telefono: string
  combustible: string
  logo_url: string
  activo: boolean
  created_at?: string
}

export interface FuelOrder {
  id: string
  num: string
  operator_id: string
  vehicle_id: string
  station_id?: string | null
  despachador_id?: string | null
  galones?: number | null
  valor_total?: number | null
  kilometraje_actual?: number | null
  rendimiento_real?: number | null
  rendimiento_esperado: number
  alcance_estimado?: number | null
  gps_lat?: number | null
  gps_lng?: number | null
  gps_precision?: number | null
  gps_maps_url?: string | null
  nivel_tanque?: string | null
  nivel_tanque_porcentaje?: number | null
  observaciones?: string | null
  ejecucion_observaciones?: string | null
  alerta_rendimiento: boolean
  estado: OrderStatus
  fecha_emision: string
  fecha_vencimiento: string
  fecha_ejecucion?: string | null
  created_at: string
  vehicles?: Vehicle
  profiles?: Profile
  despachador?: Profile
  station?: ServiceStation
  order_photos?: OrderPhoto[]
}

export interface FuelRecord {
  id: string
  order_id: string
  operator_id: string
  vehicle_id: string
  station_id?: string | null
  despachador_id?: string | null
  fecha: string
  kilometraje_actual: number
  galones: number
  valor_total: number
  nivel_tanque: string
  nivel_tanque_porcentaje: number
  rendimiento_real?: number | null
  rendimiento_esperado: number
  alcance_estimado: number
  alerta_rendimiento: boolean
  observaciones?: string | null
  gps_lat?: number | null
  gps_lng?: number | null
  gps_precision?: number | null
  gps_maps_url?: string | null
  created_at: string
  fuel_orders?: FuelOrder
  profiles?: Profile
  vehicles?: Vehicle
  despachador?: Profile
  station?: ServiceStation
  order_photos?: OrderPhoto[]
}

export interface OrderPhoto {
  id: string
  order_id: string
  record_id?: string | null
  tipo: PhotoType
  photo_url: string
  storage_path?: string | null
  created_at?: string
}

export interface UploadedEvidence {
  path: string
  url: string
}
