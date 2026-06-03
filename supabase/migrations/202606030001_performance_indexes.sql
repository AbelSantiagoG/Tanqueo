-- Performance indexes for list, dashboard and history screens.
-- Safe to run more than once.

create index if not exists idx_orders_created_at_desc
on public.fuel_orders (created_at desc);

create index if not exists idx_orders_status_created_at_desc
on public.fuel_orders (estado, created_at desc);

create index if not exists idx_orders_operator_created_at_desc
on public.fuel_orders (operator_id, created_at desc);

create index if not exists idx_orders_vehicle_created_at_desc
on public.fuel_orders (vehicle_id, created_at desc);

create index if not exists idx_records_created_at_desc
on public.fuel_records (created_at desc);

create index if not exists idx_records_fecha_desc
on public.fuel_records (fecha desc);

create index if not exists idx_records_operator_fecha_desc
on public.fuel_records (operator_id, fecha desc);

create index if not exists idx_records_vehicle_fecha_desc
on public.fuel_records (vehicle_id, fecha desc);

create index if not exists idx_records_order_created_at_desc
on public.fuel_records (order_id, created_at desc);

create index if not exists idx_vehicles_placa_lower
on public.vehicles (lower(placa));

create index if not exists idx_profiles_role_activo_name
on public.profiles (role, activo, full_name);

create index if not exists idx_service_stations_activo_nombre
on public.service_stations (activo, nombre);
