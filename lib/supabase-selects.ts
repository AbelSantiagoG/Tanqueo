export const PROFILE_SELECT = "id, full_name, role, email, cedula, telefono, cargo, zona, observaciones, activo, created_at"

export const SETTINGS_SELECT = "id, emp_nombre, emp_nit, emp_dir, emp_tel, emp_email, emp_ciudad, emp_logo, prefix, dias_venc, alert_pct"

export const STATION_SELECT = "id, nombre, nit, direccion, telefono, combustible, logo_url, activo, created_at"

export const STATION_OPTION_SELECT = "id, nombre, combustible, activo"

export const VEHICLE_SELECT = "id, placa, marca, tipo, modelo, anio, color, capacidad_tanque, rendimiento_esperado, operario_asignado_id, kilometraje_inicial, activo, created_at, profiles:operario_asignado_id(id, full_name)"

const ORDER_CORE_SELECT = "id, num, operator_id, vehicle_id, station_id, despachador_id, galones, valor_total, kilometraje_actual, rendimiento_real, rendimiento_esperado, alcance_estimado, gps_lat, gps_lng, gps_precision, gps_maps_url, nivel_tanque, nivel_tanque_porcentaje, observaciones, ejecucion_observaciones, alerta_rendimiento, estado, fecha_emision, fecha_vencimiento, fecha_ejecucion, created_at"

export const ORDER_SELECT_WITH_STATION = `${ORDER_CORE_SELECT}, vehicles:vehicle_id(id, placa, marca, tipo, modelo, anio, color, capacidad_tanque, rendimiento_esperado, operario_asignado_id, kilometraje_inicial, activo), station:station_id(${STATION_SELECT}), profiles:operator_id(id, full_name, role, cedula, telefono), despachador:despachador_id(id, full_name, role, cedula, telefono)`

export const ORDER_SELECT_WITHOUT_STATION = `${ORDER_CORE_SELECT}, vehicles:vehicle_id(id, placa, marca, tipo, modelo, anio, color, capacidad_tanque, rendimiento_esperado, operario_asignado_id, kilometraje_inicial, activo), profiles:operator_id(id, full_name, role, cedula, telefono), despachador:despachador_id(id, full_name, role, cedula, telefono)`

export const RECORD_CORE_SELECT = "id, order_id, operator_id, vehicle_id, station_id, despachador_id, fecha, kilometraje_actual, galones, valor_total, nivel_tanque, nivel_tanque_porcentaje, rendimiento_real, rendimiento_esperado, alcance_estimado, alerta_rendimiento, observaciones, gps_lat, gps_lng, gps_precision, gps_maps_url, created_at"

export const PHOTO_SELECT = "id, order_id, record_id, tipo, photo_url, storage_path, created_at"

export function fuelRecordSelect(stationSchemaReady: boolean, includePhotos = false) {
  const orderSelect = stationSchemaReady ? `fuel_orders(${ORDER_SELECT_WITH_STATION})` : `fuel_orders(${ORDER_SELECT_WITHOUT_STATION})`
  const stationSelect = stationSchemaReady ? `, station:station_id(${STATION_SELECT})` : ""
  const photosSelect = includePhotos ? `, order_photos(${PHOTO_SELECT})` : ""
  return `${RECORD_CORE_SELECT}, ${orderSelect}${stationSelect}, profiles:operator_id(id, full_name, role, cedula, telefono), vehicles:vehicle_id(id, placa, marca, tipo, modelo, anio, color, capacidad_tanque, rendimiento_esperado, operario_asignado_id, kilometraje_inicial, activo), despachador:despachador_id(id, full_name, role, cedula, telefono)${photosSelect}`
}
