-- ASUCAP fuel control: production schema aligned with the existing React app.
-- Apply from the Supabase SQL editor or with `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  emp_nombre text not null default 'ASUCAP',
  emp_nit text not null default '',
  emp_dir text not null default '',
  emp_tel text not null default '',
  emp_email text not null default '',
  emp_ciudad text not null default '',
  emp_logo text not null default '',
  est_nombre text not null default 'Estacion de Servicio',
  est_nit text not null default '',
  est_dir text not null default '',
  est_tel text not null default '',
  est_comb text not null default 'Corriente',
  est_logo text not null default '',
  prefix text not null default 'OS',
  dias_venc integer not null default 3,
  alert_pct numeric(5, 2) not null default 20,
  created_at timestamptz not null default now()
);

alter table public.company_settings add column if not exists admin_pin_hash text;
alter table public.company_settings add column if not exists pin text;
alter table public.company_settings add column if not exists updated_at timestamptz not null default now();
alter table public.company_settings drop column if exists est_precio;

update public.company_settings
set admin_pin_hash = crypt(pin, gen_salt('bf')), pin = null
where nullif(trim(pin), '') is not null and admin_pin_hash is null;

create table if not exists public.service_stations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text not null default '',
  direccion text not null default '',
  telefono text not null default '',
  combustible text not null default 'Corriente',
  logo_url text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_stations drop column if exists precio_galon;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'operario',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists cedula text;
alter table public.profiles add column if not exists telefono text;
alter table public.profiles add column if not exists cargo text;
alter table public.profiles add column if not exists zona text;
alter table public.profiles add column if not exists observaciones text;
alter table public.profiles add column if not exists activo boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  marca text not null,
  rendimiento_esperado numeric(10, 2) not null default 50,
  created_at timestamptz not null default now()
);

alter table public.vehicles add column if not exists tipo text not null default 'moto';
alter table public.vehicles add column if not exists modelo text;
alter table public.vehicles add column if not exists anio text;
alter table public.vehicles add column if not exists color text;
alter table public.vehicles add column if not exists capacidad_tanque numeric(10, 2) not null default 0;
alter table public.vehicles add column if not exists operario_asignado_id uuid references public.profiles(id) on delete set null;
alter table public.vehicles add column if not exists kilometraje_inicial numeric(14, 2) not null default 0;
alter table public.vehicles add column if not exists activo boolean not null default true;
alter table public.vehicles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.fuel_orders (
  id uuid primary key default gen_random_uuid(),
  num text not null unique,
  operator_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  rendimiento_esperado numeric(10, 2) not null default 50,
  estado text not null default 'pendiente',
  fecha_emision date not null default current_date,
  fecha_vencimiento date not null,
  created_at timestamptz not null default now()
);

alter table public.fuel_orders add column if not exists despachador_id uuid references public.profiles(id) on delete set null;
alter table public.fuel_orders add column if not exists station_id uuid references public.service_stations(id) on delete restrict;
alter table public.fuel_orders add column if not exists galones numeric(10, 2);
alter table public.fuel_orders add column if not exists valor_total numeric(14, 2);
alter table public.fuel_orders add column if not exists kilometraje_actual numeric(14, 2);
alter table public.fuel_orders add column if not exists rendimiento_real numeric(10, 2);
alter table public.fuel_orders add column if not exists gps_lat double precision;
alter table public.fuel_orders add column if not exists gps_lng double precision;
alter table public.fuel_orders add column if not exists gps_precision double precision;
alter table public.fuel_orders add column if not exists gps_maps_url text;
alter table public.fuel_orders add column if not exists nivel_tanque text;
alter table public.fuel_orders add column if not exists nivel_tanque_porcentaje integer;
alter table public.fuel_orders add column if not exists observaciones text;
alter table public.fuel_orders add column if not exists ejecucion_observaciones text;
alter table public.fuel_orders add column if not exists alerta_rendimiento boolean not null default false;
alter table public.fuel_orders add column if not exists alcance_estimado numeric(14, 2);
alter table public.fuel_orders add column if not exists fecha_ejecucion date;
alter table public.fuel_orders add column if not exists updated_at timestamptz not null default now();

-- Remove earlier RPC versions before dropping columns referenced by their
-- implementations. This keeps the migration re-runnable on existing projects.
drop function if exists public.create_fuel_order(uuid, uuid, numeric, date, date, text);
drop function if exists public.create_fuel_order(uuid, uuid, uuid, numeric, date, date, text);
drop function if exists public.create_fuel_order(uuid, uuid, uuid, date, date, text);
drop function if exists public.execute_fuel_order(uuid, date, numeric, numeric, numeric, text, integer, text, double precision, double precision, double precision, text, text, text, text, text, text);

alter table public.fuel_orders drop column if exists galones_autorizados;

-- Older installations used execution fields as required order fields. They must
-- remain empty while an order is pending.
alter table public.fuel_orders alter column galones drop not null;
alter table public.fuel_orders alter column valor_total drop not null;
alter table public.fuel_orders alter column kilometraje_actual drop not null;
alter table public.fuel_orders alter column rendimiento_real drop not null;
alter table public.fuel_orders alter column nivel_tanque drop not null;
alter table public.fuel_orders alter column nivel_tanque_porcentaje drop not null;

create table if not exists public.fuel_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.fuel_orders(id) on delete cascade,
  operator_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  station_id uuid references public.service_stations(id) on delete restrict,
  despachador_id uuid references public.profiles(id) on delete set null,
  fecha date not null default current_date,
  kilometraje_actual numeric(14, 2) not null,
  galones numeric(10, 2) not null,
  valor_total numeric(14, 2) not null,
  nivel_tanque text not null,
  nivel_tanque_porcentaje integer not null,
  rendimiento_real numeric(10, 2),
  rendimiento_esperado numeric(10, 2) not null,
  alcance_estimado numeric(14, 2) not null,
  alerta_rendimiento boolean not null default false,
  observaciones text,
  gps_lat double precision,
  gps_lng double precision,
  gps_precision double precision,
  gps_maps_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.fuel_orders(id) on delete cascade,
  tipo text not null,
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.fuel_records add column if not exists station_id uuid references public.service_stations(id) on delete restrict;
alter table public.order_photos add column if not exists record_id uuid references public.fuel_records(id) on delete cascade;
alter table public.order_photos add column if not exists storage_path text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.order_photos'::regclass and contype = 'c'
  loop
    execute format('alter table public.order_photos drop constraint %I', constraint_name);
  end loop;
  alter table public.order_photos
    add constraint order_photos_tipo_check check (tipo in ('odometro', 'tanque', 'factura'));
end;
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_vehicles_operator on public.vehicles(operario_asignado_id);
create index if not exists idx_orders_operator_status on public.fuel_orders(operator_id, estado);
create index if not exists idx_orders_vehicle on public.fuel_orders(vehicle_id);
create index if not exists idx_orders_station on public.fuel_orders(station_id);
create index if not exists idx_orders_expiry on public.fuel_orders(estado, fecha_vencimiento);
create index if not exists idx_records_operator on public.fuel_records(operator_id, created_at desc);
create index if not exists idx_records_vehicle on public.fuel_records(vehicle_id, created_at desc);
create index if not exists idx_records_station on public.fuel_records(station_id, created_at desc);
create index if not exists idx_photos_order on public.order_photos(order_id);

insert into public.company_settings (emp_nombre)
select 'ASUCAP'
where not exists (select 1 from public.company_settings);

insert into public.service_stations (nombre, nit, direccion, telefono, combustible, logo_url)
select est_nombre, est_nit, est_dir, est_tel, est_comb, est_logo
from public.company_settings
where not exists (select 1 from public.service_stations)
order by created_at
limit 1;

update public.fuel_orders
set station_id = (select id from public.service_stations order by created_at limit 1)
where station_id is null;

update public.fuel_records r
set station_id = o.station_id
from public.fuel_orders o
where r.order_id = o.id and r.station_id is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias-tanqueo',
  'evidencias-tanqueo',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and activo = true
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false)
$$;

create or replace function public.is_dispatcher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('admin', 'despachador'), false)
$$;

create or replace function public.get_login_profiles()
returns table(id uuid, full_name text, role text, cargo text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, coalesce(p.cargo, '')
  from public.profiles p
  where p.activo = true and p.role in ('operario', 'despachador')
  order by p.full_name
$$;

create or replace function public.expire_fuel_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.fuel_orders
  set estado = 'vencida', updated_at = now()
  where estado = 'pendiente' and fecha_vencimiento < current_date;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.create_fuel_order(
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
  cfg public.company_settings;
  vehicle public.vehicles;
  station public.service_stations;
  generated_num text;
  year_value text;
  next_value integer;
  created_order public.fuel_orders;
begin
  if not public.is_dispatcher() then
    raise exception 'No tienes permiso para crear ordenes';
  end if;
  if p_fecha_vencimiento < p_fecha_emision then
    raise exception 'La fecha de vencimiento no puede ser anterior a la emision';
  end if;

  select * into cfg from public.company_settings order by created_at limit 1;
  select * into vehicle from public.vehicles where id = p_vehicle_id and activo = true;
  if vehicle.id is null then
    raise exception 'Vehiculo no disponible';
  end if;
  select * into station from public.service_stations where id = p_station_id and activo = true;
  if station.id is null then
    raise exception 'Estacion de servicio no disponible';
  end if;

  year_value := extract(year from p_fecha_emision)::text;
  perform pg_advisory_xact_lock(hashtext(coalesce(cfg.prefix, 'OS') || '-' || year_value));
  select coalesce(max(substring(num from '([0-9]+)$')::integer), 0) + 1
  into next_value
  from public.fuel_orders
  where num like coalesce(cfg.prefix, 'OS') || '-' || year_value || '-%';
  generated_num := coalesce(cfg.prefix, 'OS') || '-' || year_value || '-' || lpad(next_value::text, 4, '0');

  insert into public.fuel_orders (
    num, operator_id, vehicle_id, station_id, despachador_id,
    rendimiento_esperado, fecha_emision, fecha_vencimiento, observaciones, estado
  ) values (
    generated_num, p_operator_id, p_vehicle_id, p_station_id, auth.uid(),
    vehicle.rendimiento_esperado, p_fecha_emision, p_fecha_vencimiento,
    nullif(trim(p_observaciones), ''), 'pendiente'
  )
  returning * into created_order;
  return created_order;
end;
$$;

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
  p_photo_odometro_url text,
  p_photo_odometro_path text,
  p_photo_tanque_url text,
  p_photo_tanque_path text,
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
  if p_photo_odometro_url is null or p_photo_tanque_url is null or p_photo_factura_url is null then
    raise exception 'Las tres evidencias fotograficas son obligatorias';
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
    (selected_order.id, record_row.id, 'odometro', p_photo_odometro_url, p_photo_odometro_path),
    (selected_order.id, record_row.id, 'tanque', p_photo_tanque_url, p_photo_tanque_path),
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

create or replace function public.set_admin_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar el PIN';
  end if;
  if length(trim(p_pin)) < 4 then
    raise exception 'El PIN debe tener al menos 4 caracteres';
  end if;
  update public.company_settings
  set admin_pin_hash = crypt(trim(p_pin), gen_salt('bf')),
      pin = null,
      updated_at = now();
end;
$$;

create or replace function public.delete_fuel_record(p_record_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_record public.fuel_records;
  paths text[];
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar registros';
  end if;
  select * into selected_record from public.fuel_records where id = p_record_id for update;
  if selected_record.id is null then
    raise exception 'Registro no encontrado';
  end if;
  select coalesce(array_agg(storage_path) filter (where storage_path is not null), array[]::text[])
  into paths
  from public.order_photos
  where record_id = p_record_id;
  delete from public.order_photos where record_id = p_record_id;
  delete from public.fuel_records where id = p_record_id;
  update public.fuel_orders
  set estado = 'cerrada',
      galones = null,
      valor_total = null,
      kilometraje_actual = null,
      rendimiento_real = null,
      gps_lat = null,
      gps_lng = null,
      gps_precision = null,
      gps_maps_url = null,
      nivel_tanque = null,
      nivel_tanque_porcentaje = null,
      ejecucion_observaciones = null,
      alerta_rendimiento = false,
      alcance_estimado = null,
      fecha_ejecucion = null,
      updated_at = now()
  where id = selected_record.order_id;
  return paths;
end;
$$;

alter table public.company_settings enable row level security;
alter table public.service_stations enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.fuel_orders enable row level security;
alter table public.fuel_records enable row level security;
alter table public.order_photos enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('company_settings', 'service_stations', 'profiles', 'vehicles', 'fuel_orders', 'fuel_records', 'order_photos')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

drop policy if exists "settings read authenticated" on public.company_settings;
create policy "settings read authenticated" on public.company_settings for select to authenticated using (true);
drop policy if exists "settings admin write" on public.company_settings;
create policy "settings admin write" on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "stations authenticated read" on public.service_stations;
create policy "stations authenticated read" on public.service_stations for select to authenticated using (true);
drop policy if exists "stations admin write" on public.service_stations;
create policy "stations admin write" on public.service_stations for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles authenticated read" on public.profiles;
create policy "profiles authenticated read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vehicles authenticated read" on public.vehicles;
create policy "vehicles authenticated read" on public.vehicles for select to authenticated using (true);
drop policy if exists "vehicles admin write" on public.vehicles;
create policy "vehicles admin write" on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders role read" on public.fuel_orders;
create policy "orders role read" on public.fuel_orders for select to authenticated
using (operator_id = auth.uid() or public.is_dispatcher());
drop policy if exists "orders dispatcher write" on public.fuel_orders;
create policy "orders dispatcher write" on public.fuel_orders for all to authenticated
using (public.is_dispatcher()) with check (public.is_dispatcher());

drop policy if exists "records role read" on public.fuel_records;
create policy "records role read" on public.fuel_records for select to authenticated
using (operator_id = auth.uid() or public.is_dispatcher());
drop policy if exists "records admin delete" on public.fuel_records;
create policy "records admin delete" on public.fuel_records for delete to authenticated
using (public.is_admin());

drop policy if exists "photos role read" on public.order_photos;
create policy "photos role read" on public.order_photos for select to authenticated
using (
  exists (
    select 1 from public.fuel_orders o
    where o.id = order_id and (o.operator_id = auth.uid() or public.is_dispatcher())
  )
);
drop policy if exists "photos admin delete" on public.order_photos;
create policy "photos admin delete" on public.order_photos for delete to authenticated
using (public.is_admin());

drop policy if exists "evidence authenticated upload" on storage.objects;
create policy "evidence authenticated upload" on storage.objects for insert to authenticated
with check (bucket_id = 'evidencias-tanqueo' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "evidence authenticated read" on storage.objects;
create policy "evidence authenticated read" on storage.objects for select to authenticated
using (bucket_id = 'evidencias-tanqueo');
drop policy if exists "evidence owner delete" on storage.objects;
create policy "evidence owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'evidencias-tanqueo' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

grant execute on function public.get_login_profiles() to anon, authenticated;
grant execute on function public.expire_fuel_orders() to authenticated;
grant execute on function public.create_fuel_order(uuid, uuid, uuid, date, date, text) to authenticated;
grant execute on function public.execute_fuel_order(uuid, date, numeric, numeric, numeric, text, integer, text, double precision, double precision, double precision, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_admin_pin(text) to authenticated;
grant execute on function public.delete_fuel_record(uuid) to authenticated;

notify pgrst, 'reload schema';
