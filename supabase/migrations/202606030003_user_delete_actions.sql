-- Admin user access actions.
-- Adds hard profile deletion while preserving the option to deactivate users.
-- Safe to run more than once.

create or replace function public.hard_delete_profile(p_profile_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  first_admin_id uuid;
  evidence_paths text[];
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede eliminar usuarios';
  end if;

  select *
  into target_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if target_profile.id is null then
    raise exception 'No se encontro la cuenta';
  end if;

  select id
  into first_admin_id
  from public.profiles
  where role = 'admin'
  order by created_at asc, id asc
  limit 1;

  if first_admin_id = p_profile_id then
    raise exception 'El primer administrador no se puede eliminar';
  end if;

  select coalesce(
    array_agg(distinct op.storage_path) filter (where op.storage_path is not null),
    array[]::text[]
  )
  into evidence_paths
  from public.order_photos op
  left join public.fuel_orders fo on fo.id = op.order_id
  left join public.fuel_records fr on fr.id = op.record_id
  where fo.operator_id = p_profile_id
     or fo.despachador_id = p_profile_id
     or fr.operator_id = p_profile_id
     or fr.despachador_id = p_profile_id;

  update public.vehicles
  set operario_asignado_id = null,
      updated_at = now()
  where operario_asignado_id = p_profile_id;

  update public.fuel_orders
  set despachador_id = null,
      updated_at = now()
  where despachador_id = p_profile_id;

  update public.fuel_records
  set despachador_id = null
  where despachador_id = p_profile_id;

  -- Orders created for this operator cascade to their records and photos.
  delete from public.fuel_orders
  where operator_id = p_profile_id;

  -- Safety for any direct or orphaned records tied to the profile.
  delete from public.fuel_records
  where operator_id = p_profile_id;

  delete from public.profiles
  where id = p_profile_id;

  return evidence_paths;
end;
$$;

grant execute on function public.hard_delete_profile(uuid) to authenticated;

notify pgrst, 'reload schema';
