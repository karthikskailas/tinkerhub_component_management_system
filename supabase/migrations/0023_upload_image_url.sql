-- Sheet upload: optional image_url column. Blank cell keeps the stored image;
-- non-blank must be an http(s) URL (max 500). Same signatures, so create or replace.
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
  error text,
  old_attributes jsonb,
  new_attributes jsonb
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
  with active as (
    select f.key, f.type, f.max_length, f.label
    from public.component_fields f
    where not f.is_core and not f.archived
  ),
  rows as (
    select
      trim(elem->>'name') as name,
      nullif(trim(elem->>'location'), '') as location,
      elem->>'count' as count_raw,
      nullif(trim(elem->>'description'), '') as description,
      (elem->>'returnable')::boolean as returnable,
      nullif(trim(elem->>'image_url'), '') as image_url,
      coalesce((
        select jsonb_object_agg(a.key, public._field_value(a.type, a.max_length, elem->>a.key))
        filter (where public._field_value(a.type, a.max_length, elem->>a.key) is not null)
        from active a
      ), '{}'::jsonb) as new_attrs,
      (
        select string_agg(a.label || ': invalid value', '; ')
        from active a
        where public._field_invalid(a.type, a.max_length, elem->>a.key)
      ) as attr_error
    from jsonb_array_elements(p_rows) elem
  ),
  validated as (
    select
      r.*,
      case
        when name is null or name = '' then 'E_INVALID: name is required'
        when count_raw is null or count_raw !~ '^[0-9]+$' then 'E_INVALID: count must be a non-negative integer'
        when image_url is not null and (char_length(image_url) > 500 or image_url !~* '^https?://') then 'E_INVALID: image_url must be an http(s) link'
        when attr_error is not null then 'E_INVALID: ' || attr_error
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
      c.returnable as c_old_returnable,
      c.image_url as c_old_image,
      case when c.id is null then v.description
           else coalesce(v.description, c.description) end as eff_description,
      case when c.id is null then coalesce(v.returnable, true)
           else coalesce(v.returnable, c.returnable) end as eff_returnable,
      coalesce((
        select jsonb_object_agg(a.key, to_jsonb(c) -> a.key)
        filter (where to_jsonb(c) -> a.key is not null and to_jsonb(c) -> a.key <> 'null'::jsonb)
        from active a
      ), '{}'::jsonb) as c_old_attrs
    from validated v
    left join public.components c
      on lower(c.name) = lower(v.name)
      and coalesce(lower(c.location), '') = coalesce(lower(v.location), '')
  ),
  final as (
    select m.*, m.c_old_attrs || m.new_attrs as eff_attrs from matched m
  )
  select
    m.name,
    m.location,
    case
      when m.validation_error is not null then 'invalid'
      when m.c_id is null then 'new'
      when m.parsed_count < m.c_reserved then 'invalid'
      when m.parsed_count is distinct from m.c_old_count
        or m.eff_description is distinct from m.c_old_description
        or m.eff_returnable is distinct from m.c_old_returnable
        or (m.image_url is not null and m.image_url is distinct from m.c_old_image)
        or m.eff_attrs <> m.c_old_attrs
        then 'changed'
      else 'unchanged'
    end,
    m.c_id,
    m.c_old_count,
    m.parsed_count,
    m.c_old_description,
    m.eff_description,
    m.c_old_returnable,
    m.eff_returnable,
    coalesce(
      m.validation_error,
      case
        when m.c_id is not null and m.parsed_count < m.c_reserved
          then format('E_STOCK: new count %s is below reserved %s', m.parsed_count, m.c_reserved)
        else null
      end
    ),
    m.c_old_attrs,
    m.eff_attrs
  from final m;
end;
$$;

revoke all on function preview_inventory_upload(jsonb) from public, anon;
grant execute on function preview_inventory_upload(jsonb) to authenticated;

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
  v_key text;
begin
  if not public.is_staff() then
    raise exception 'E_FORBIDDEN: staff role required' using errcode = 'P0001';
  end if;

  drop table if exists tmp_upload_diff;
  create temporary table tmp_upload_diff on commit drop as
  select * from public.preview_inventory_upload(p_rows);

  insert into public.components (name, location, count, description, returnable, updated_by)
  select row_name, row_location, new_count, new_description, new_returnable, auth.uid()
  from tmp_upload_diff
  where diff = 'new';

  update public.components c
    set count = d.new_count,
        description = d.new_description,
        returnable = d.new_returnable,
        updated_by = auth.uid()
    from tmp_upload_diff d
    where d.diff = 'changed' and d.component_id = c.id;

  update public.components c
    set image_url = nullif(trim(e->>'image_url'), '')
    from jsonb_array_elements(p_rows) e, tmp_upload_diff d
    where d.diff in ('new', 'changed')
      and nullif(trim(e->>'image_url'), '') is not null
      and lower(trim(e->>'name')) = lower(d.row_name)
      and coalesce(lower(nullif(trim(e->>'location'), '')), '') = coalesce(lower(d.row_location), '')
      and lower(c.name) = lower(d.row_name)
      and coalesce(lower(c.location), '') = coalesce(lower(d.row_location), '');

  -- Custom fields: one set-based update per active field (at most 20).
  for v_key in
    select key from public.component_fields where not is_core and not archived
  loop
    execute format(
      'update public.components c
         set %1$I = (jsonb_populate_record(null::public.components, d.new_attributes)).%1$I
         from tmp_upload_diff d
         where d.diff in (''new'', ''changed'')
           and d.new_attributes ? %2$L
           and lower(c.name) = lower(d.row_name)
           and coalesce(lower(c.location), '''') = coalesce(lower(d.row_location), '''')',
      v_key, v_key
    );
  end loop;

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
