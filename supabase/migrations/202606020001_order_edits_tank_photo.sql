-- Incremental update: editable pending orders and three required evidence photos.
-- Apply after 202606010001_full_fuel_control.sql.

alter table public.order_photos
  drop constraint if exists order_photos_tipo_check;

alter table public.order_photos
  add constraint order_photos_tipo_check
  check (tipo in ('odometro', 'tanque', 'tablero', 'nivel_tanque', 'factura'));

drop function if exists public.execute_fuel_order(
  uuid, date, numeric, numeric, numeric, text, integer, text,
  double precision, double precision, double precision,
  text, text, text, text
);

create or replace function public.execute_fuel_order(
  p_order_id uuid,
  p_fecha date,
  p_kilometraje_actual numeric,
  p_galones numeric,
  p_valor_total numeric,
  p_nivel_tanque text,
  p_nivel_tanque_porcentaje integer,
  p_observaciones text,
  p_gps_lat double precision,
  p_gps_lng double precision,
  p_gps_precision double precision,
  p_photo_tablero_url text,
  p_photo_tablero_path text,
  p_photo_nivel_tanque_url text,
  p_photo_nivel_tanque_path text,
  p_photo_factura_url text,
  p_photo_factura_path text
)
returns public.fuel_records
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_order public.fuel_orders;
  previous_record public.fuel_records;
  cfg public.company_settings;
  record_row public.fuel_records;
  real_yield numeric(10, 2);
  projected_range numeric(14, 2);
  has_alert boolean;
  maps_url text;
begin
  perform public.expire_fuel_orders();
  select * into selected_order from public.fuel_orders where id = p_order_id for update;
  if selected_order.id is null then
    raise exception 'Orden no encontrada';
  end if;
  if selected_order.operator_id <> auth.uid() and not public.is_admin() then
    raise exception 'La orden no pertenece al operario autenticado';
  end if;
  if selected_order.estado <> 'pendiente' then
    raise exception 'La orden no esta disponible para ejecucion: %', selected_order.estado;
  end if;
  if p_kilometraje_actual <= 0 or p_galones <= 0 or p_valor_total <= 0 then
    raise exception 'Kilometraje, galones y valor deben ser mayores que cero';
  end if;
  if p_photo_tablero_url is null or p_photo_nivel_tanque_url is null or p_photo_factura_url is null then
    raise exception 'Las fotos del tablero, nivel del tanque y factura son obligatorias';
  end if;
  if selected_order.station_id is null or not exists (
    select 1 from public.service_stations where id = selected_order.station_id and activo = true
  ) then
    raise exception 'La estacion asignada a la orden no esta disponible';
  end if;

  select * into cfg from public.company_settings order by created_at limit 1;
  select * into previous_record
  from public.fuel_records
  where vehicle_id = selected_order.vehicle_id
  order by created_at desc
  limit 1;

  if previous_record.id is not null then
    if p_kilometraje_actual <= previous_record.kilometraje_actual then
      raise exception 'El kilometraje actual debe ser mayor al registro anterior';
    end if;
    real_yield := round((p_kilometraje_actual - previous_record.kilometraje_actual) / previous_record.galones, 2);
  end if;
  projected_range := round(p_galones * selected_order.rendimiento_esperado, 2);
  has_alert := real_yield is not null
    and real_yield < selected_order.rendimiento_esperado * (1 - coalesce(cfg.alert_pct, 20) / 100);
  maps_url := case
    when p_gps_lat is null or p_gps_lng is null then null
    else 'https://www.google.com/maps?q=' || p_gps_lat || ',' || p_gps_lng
  end;

  insert into public.fuel_records (
    order_id, operator_id, vehicle_id, station_id, despachador_id, fecha, kilometraje_actual,
    galones, valor_total, nivel_tanque, nivel_tanque_porcentaje, rendimiento_real,
    rendimiento_esperado, alcance_estimado, alerta_rendimiento, observaciones,
    gps_lat, gps_lng, gps_precision, gps_maps_url
  ) values (
    selected_order.id, selected_order.operator_id, selected_order.vehicle_id,
    selected_order.station_id, selected_order.despachador_id, p_fecha, p_kilometraje_actual, p_galones,
    p_valor_total, p_nivel_tanque, p_nivel_tanque_porcentaje, real_yield,
    selected_order.rendimiento_esperado, projected_range, has_alert,
    nullif(trim(p_observaciones), ''), p_gps_lat, p_gps_lng, p_gps_precision, maps_url
  )
  returning * into record_row;

  insert into public.order_photos (order_id, record_id, tipo, photo_url, storage_path)
  values
    (selected_order.id, record_row.id, 'tablero', p_photo_tablero_url, p_photo_tablero_path),
    (selected_order.id, record_row.id, 'nivel_tanque', p_photo_nivel_tanque_url, p_photo_nivel_tanque_path),
    (selected_order.id, record_row.id, 'factura', p_photo_factura_url, p_photo_factura_path);

  update public.fuel_orders
  set galones = p_galones,
      valor_total = p_valor_total,
      kilometraje_actual = p_kilometraje_actual,
      rendimiento_real = real_yield,
      gps_lat = p_gps_lat,
      gps_lng = p_gps_lng,
      gps_precision = p_gps_precision,
      gps_maps_url = maps_url,
      nivel_tanque = p_nivel_tanque,
      nivel_tanque_porcentaje = p_nivel_tanque_porcentaje,
      ejecucion_observaciones = nullif(trim(p_observaciones), ''),
      alerta_rendimiento = has_alert,
      alcance_estimado = projected_range,
      fecha_ejecucion = p_fecha,
      estado = 'ejecutada',
      updated_at = now()
  where id = selected_order.id;

  return record_row;
end;
$$;

drop function if exists public.update_fuel_order(uuid, uuid, uuid, uuid, date, date, text);

create or replace function public.update_fuel_order(
  p_order_id uuid,
  p_operator_id uuid,
  p_vehicle_id uuid,
  p_station_id uuid,
  p_fecha_emision date,
  p_fecha_vencimiento date,
  p_observaciones text default null
)
returns public.fuel_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_order public.fuel_orders;
  vehicle public.vehicles;
  station public.service_stations;
  updated_order public.fuel_orders;
begin
  if not public.is_dispatcher() then
    raise exception 'No tienes permiso para editar ordenes';
  end if;
  select * into selected_order from public.fuel_orders where id = p_order_id for update;
  if selected_order.id is null then
    raise exception 'Orden no encontrada';
  end if;
  if selected_order.estado not in ('pendiente', 'vencida') then
    raise exception 'Solo se pueden editar ordenes pendientes o vencidas';
  end if;
  if p_fecha_vencimiento < p_fecha_emision then
    raise exception 'La fecha de vencimiento no puede ser anterior a la emision';
  end if;
  select * into vehicle from public.vehicles where id = p_vehicle_id and activo = true;
  if vehicle.id is null then
    raise exception 'Vehiculo no disponible';
  end if;
  select * into station from public.service_stations where id = p_station_id and activo = true;
  if station.id is null then
    raise exception 'Estacion de servicio no disponible';
  end if;
  if not exists (select 1 from public.profiles where id = p_operator_id and role = 'operario' and activo = true) then
    raise exception 'Operario no disponible';
  end if;

  update public.fuel_orders
  set operator_id = p_operator_id,
      vehicle_id = p_vehicle_id,
      station_id = p_station_id,
      rendimiento_esperado = vehicle.rendimiento_esperado,
      fecha_emision = p_fecha_emision,
      fecha_vencimiento = p_fecha_vencimiento,
      observaciones = nullif(trim(p_observaciones), ''),
      estado = case
        when selected_order.estado = 'vencida' and p_fecha_vencimiento >= current_date then 'pendiente'
        else selected_order.estado
      end,
      updated_at = now()
  where id = selected_order.id
  returning * into updated_order;

  return updated_order;
end;
$$;

grant execute on function public.execute_fuel_order(
  uuid, date, numeric, numeric, numeric, text, integer, text,
  double precision, double precision, double precision,
  text, text, text, text, text, text
) to authenticated;

grant execute on function public.update_fuel_order(uuid, uuid, uuid, uuid, date, date, text) to authenticated;

notify pgrst, 'reload schema';
