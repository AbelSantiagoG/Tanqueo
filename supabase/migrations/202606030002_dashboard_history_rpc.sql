-- Exact historical dashboard aggregates without loading all records in the browser.
-- Safe to run more than once.

create or replace function public.get_dashboard_history()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_dispatcher() then
    raise exception 'No tienes permiso para consultar el dashboard';
  end if;

  perform public.expire_fuel_orders();

  select jsonb_build_object(
    'metrics', (
      select jsonb_build_object(
        'records', count(*),
        'gallons', coalesce(sum(r.galones), 0),
        'value', coalesce(sum(r.valor_total), 0),
        'average', coalesce(avg(r.galones), 0),
        'alerts', count(*) filter (where r.alerta_rendimiento),
        'pending', (select count(*) from public.fuel_orders o where o.estado = 'pendiente')
      )
      from public.fuel_records r
    ),
    'monthly', coalesce((
      select jsonb_agg(row_to_json(monthly_row) order by monthly_row.name)
      from (
        select
          to_char(r.fecha, 'YYYY-MM') as name,
          coalesce(sum(r.galones), 0) as gallons,
          coalesce(sum(r.valor_total), 0) as value
        from public.fuel_records r
        group by to_char(r.fecha, 'YYYY-MM')
      ) monthly_row
    ), '[]'::jsonb),
    'byOperator', coalesce((
      select jsonb_agg(row_to_json(operator_row) order by operator_row.value desc)
      from (
        select
          coalesce(p.full_name, 'Sin nombre') as name,
          coalesce(sum(r.valor_total), 0) as value
        from public.fuel_records r
        left join public.profiles p on p.id = r.operator_id
        group by coalesce(p.full_name, 'Sin nombre')
      ) operator_row
    ), '[]'::jsonb),
    'byBrand', coalesce((
      select jsonb_agg(row_to_json(brand_row) order by brand_row.value desc)
      from (
        select
          coalesce(v.marca, 'Otra') as name,
          count(*) as count,
          coalesce(sum(r.galones), 0) as gallons,
          coalesce(sum(r.valor_total), 0) as value,
          coalesce(sum(coalesce(r.rendimiento_real, 0)), 0) as yield,
          count(r.rendimiento_real) as "yieldCount"
        from public.fuel_records r
        left join public.vehicles v on v.id = r.vehicle_id
        group by coalesce(v.marca, 'Otra')
      ) brand_row
    ), '[]'::jsonb),
    'byVehicle', coalesce((
      select jsonb_agg(row_to_json(vehicle_row) order by vehicle_row.gallons desc)
      from (
        select
          coalesce(v.placa, 'Sin placa') as name,
          count(*) as count,
          coalesce(sum(r.galones), 0) as gallons,
          coalesce(sum(r.valor_total), 0) as value,
          coalesce(sum(coalesce(r.rendimiento_real, 0)), 0) as yield,
          count(r.rendimiento_real) as "yieldCount"
        from public.fuel_records r
        left join public.vehicles v on v.id = r.vehicle_id
        group by coalesce(v.placa, 'Sin placa')
      ) vehicle_row
    ), '[]'::jsonb),
    'orderStatus', coalesce((
      select jsonb_agg(row_to_json(status_row) order by status_row.name)
      from (
        select
          o.estado as name,
          count(*) as count
        from public.fuel_orders o
        group by o.estado
      ) status_row
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_dashboard_history() to authenticated;

notify pgrst, 'reload schema';
