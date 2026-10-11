-- Inventory RPCs: preview_inventory_upload, commit_inventory_upload, adjust_component.
-- All set-based (no per-row loops) so ~2,000-row sheets stay fast.

-- ============================================================
-- preview_inventory_upload (staff)
-- ============================================================
create or replace function preview_inventory_upload(p_rows jsonb)
returns table (
  row_name text,
  row_location text,
  diff text,
  component_id uuid,
  old_count int,
  new_count int,
  old_description text,
  new_description text,
  old_returnable boolean,
  new_returnable boolean,
  error text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;

  return query
  with rows as (
    select
      trim(elem->>'name') as name,
      nullif(trim(elem->>'location'), '') as location,
      elem->>'count' as count_raw,
      elem->>'description' as description,
      coalesce((elem->>'returnable')::boolean, true) as returnable
    from jsonb_array_elements(p_rows) elem
  ),
  validated as (
    select
      r.*,
      case
        when name is null or name = '' then 'E_INVALID: name is required'
        when count_raw is null or count_raw !~ '^[0-9]+$' then 'E_INVALID: count must be a non-negative integer'
        else null
      end as validation_error,
      case when count_raw ~ '^[0-9]+$' then count_raw::int else null end as parsed_count
    from rows r
  ),
  matched as (
    select
      v.*,
      c.id as c_id,
      c.count as c_old_count,
      c.reserved as c_reserved,
      c.description as c_old_description,
      c.returnable as c_old_returnable
    from validated v
    left join public.components c
      on lower(c.name) = lower(v.name)
      and coalesce(lower(c.location), '') = coalesce(lower(v.location), '')
  )
  select
    m.name,
    m.location,
    case
      when m.validation_error is not null then 'invalid'
      when m.c_id is null then 'new'
      when m.parsed_count < m.c_reserved then 'invalid'
      when m.parsed_count is distinct from m.c_old_count
        or m.description is distinct from m.c_old_description
        or m.returnable is distinct from m.c_old_returnable
        then 'changed'
      else 'unchanged'
    end,
    m.c_id,
    m.c_old_count,
    m.parsed_count,
    m.c_old_description,
    m.description,
    m.c_old_returnable,
    m.returnable,
    coalesce(
      m.validation_error,
      case
        when m.c_id is not null and m.parsed_count < m.c_reserved
          then format('E_STOCK: new count %s is below reserved %s', m.parsed_count, m.c_reserved)
        else null
      end
    )
  from matched m;
end;
$$;

revoke all on function preview_inventory_upload(jsonb) from public, anon;
grant execute on function preview_inventory_upload(jsonb) to authenticated;

-- ============================================================
-- commit_inventory_upload (staff)
-- ============================================================
create or replace function commit_inventory_upload(p_rows jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
  v_updated int;
  v_unchanged int;
  v_invalid int;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;

  drop table if exists tmp_upload_diff;
  create temporary table tmp_upload_diff on commit drop as
  select * from public.preview_inventory_upload(p_rows);

  insert into public.components (name, location, count, description, returnable)
  select row_name, row_location, new_count, new_description, new_returnable
  from tmp_upload_diff
  where diff = 'new';

  update public.components c
    set count = d.new_count,
        description = d.new_description,
        returnable = d.new_returnable
    from tmp_upload_diff d
    where d.diff = 'changed' and d.component_id = c.id;

  insert into public.inventory_adjustments (component_id, old_count, new_count, reason, source, actor_id)
  select component_id, old_count, new_count, coalesce(p_reason, 'inventory upload'), 'commit_inventory_upload', auth.uid()
  from tmp_upload_diff
  where diff = 'changed' and old_count is distinct from new_count;

  select count(*) filter (where diff = 'new'),
         count(*) filter (where diff = 'changed'),
         count(*) filter (where diff = 'unchanged'),
         count(*) filter (where diff = 'invalid')
  into v_inserted, v_updated, v_unchanged, v_invalid
  from tmp_upload_diff;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'invalid', v_invalid
  );
end;
$$;

revoke all on function commit_inventory_upload(jsonb, text) from public, anon;
grant execute on function commit_inventory_upload(jsonb, text) to authenticated;

-- ============================================================
-- adjust_component (staff, single manual edit)
-- ============================================================
create or replace function adjust_component(p_component_id uuid, p_new_count int, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_count int;
  v_reserved int;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;

  if p_new_count < 0 then
    raise exception 'E_INVALID_INPUT: count cannot be negative' using errcode = 'P0001';
  end if;

  select count, reserved into v_old_count, v_reserved
  from public.components where id = p_component_id for update;

  if v_old_count is null then
    raise exception 'E_NOT_FOUND: component not found' using errcode = 'P0001';
  end if;

  if p_new_count < v_reserved then
    raise exception 'E_STOCK: new count % is below reserved %', p_new_count, v_reserved using errcode = 'P0001';
  end if;

  update public.components set count = p_new_count where id = p_component_id;

  insert into public.inventory_adjustments (component_id, old_count, new_count, reason, source, actor_id)
  values (p_component_id, v_old_count, p_new_count, p_reason, 'adjust_component', auth.uid());
end;
$$;

revoke all on function adjust_component(uuid, int, text) from public, anon;
grant execute on function adjust_component(uuid, int, text) to authenticated;
