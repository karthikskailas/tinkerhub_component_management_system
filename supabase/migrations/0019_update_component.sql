-- Phase 4.2: edit a component (update_component), audit it (component_edits),
-- record who last touched a row (components.updated_by), and make uploads
-- never erase stored values with blank cells.
--
-- The sample sheet (Name, Count, Location, New count, Description) has no
-- columns beyond the existing core fields, so no extra component columns are
-- added; see docs/inventory-field-mapping.md.

alter table components add column if not exists updated_by uuid;

-- ============================================================
-- component_edits: old/new values of changed fields (staff read only)
-- ============================================================
create table if not exists component_edits (
  id bigint generated always as identity primary key,
  component_id uuid not null references components (id) on delete cascade,
  actor_id uuid,
  changes jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_component_edits_component_created
  on component_edits (component_id, created_at desc);

alter table component_edits enable row level security;
drop policy if exists component_edits_select_staff on component_edits;
create policy component_edits_select_staff on component_edits
  for select to authenticated using (is_staff());
grant select on component_edits to authenticated;

-- ============================================================
-- preview_inventory_upload: blank description / returnable cells keep the
-- stored value (new rows: null description, returnable true).
-- Same signature and return type as 0007, so create or replace is enough.
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
      nullif(trim(elem->>'description'), '') as description,
      (elem->>'returnable')::boolean as returnable
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
      c.returnable as c_old_returnable,
      case when c.id is null then v.description
           else coalesce(v.description, c.description) end as eff_description,
      case when c.id is null then coalesce(v.returnable, true)
           else coalesce(v.returnable, c.returnable) end as eff_returnable
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
        or m.eff_description is distinct from m.c_old_description
        or m.eff_returnable is distinct from m.c_old_returnable
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
    )
  from matched m;
end;
$$;

revoke all on function preview_inventory_upload(jsonb) from public, anon;
grant execute on function preview_inventory_upload(jsonb) to authenticated;

-- ============================================================
-- commit_inventory_upload: as 0007, plus updated_by.
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
-- update_component (admin / inventory_manager). Never touches count.
-- Keys present in p_fields are applied; absent keys are left alone. Blank
-- location/description/image_url clear the field.
-- ============================================================
create or replace function update_component(p_component_id uuid, p_fields jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.components%rowtype;
  v_name text;
  v_location text;
  v_description text;
  v_image_url text;
  v_returnable boolean;
  v_changes jsonb := '{}'::jsonb;
begin
  if public.staff_role() is null or public.staff_role()::text not in ('admin', 'inventory_manager') then
    raise exception 'E_FORBIDDEN: admin or inventory manager role required' using errcode = 'P0001';
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception 'E_INVALID_INPUT: fields must be an object' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_fields) k
    where k not in ('name', 'location', 'description', 'returnable', 'image_url')
  ) then
    raise exception 'E_INVALID_INPUT: unknown or read-only field' using errcode = 'P0001';
  end if;

  select * into v_old from public.components where id = p_component_id for update;
  if not found then
    raise exception 'E_NOT_FOUND: component not found' using errcode = 'P0001';
  end if;

  v_name := v_old.name;
  v_location := v_old.location;
  v_description := v_old.description;
  v_image_url := v_old.image_url;
  v_returnable := v_old.returnable;

  if p_fields ? 'name' then
    v_name := trim(p_fields->>'name');
    if v_name is null or v_name = '' or char_length(v_name) > 200 then
      raise exception 'E_INVALID_INPUT: name is required (max 200 characters)' using errcode = 'P0001';
    end if;
  end if;
  if p_fields ? 'location' then
    v_location := nullif(trim(p_fields->>'location'), '');
    if char_length(v_location) > 200 then
      raise exception 'E_INVALID_INPUT: location is too long (max 200 characters)' using errcode = 'P0001';
    end if;
  end if;
  if p_fields ? 'description' then
    v_description := nullif(trim(p_fields->>'description'), '');
    if char_length(v_description) > 500 then
      raise exception 'E_INVALID_INPUT: description is too long (max 500 characters)' using errcode = 'P0001';
    end if;
  end if;
  if p_fields ? 'image_url' then
    v_image_url := nullif(trim(p_fields->>'image_url'), '');
    if v_image_url is not null and (char_length(v_image_url) > 500 or v_image_url !~* '^https?://') then
      raise exception 'E_INVALID_INPUT: image link must start with http:// or https://' using errcode = 'P0001';
    end if;
  end if;
  if p_fields ? 'returnable' then
    if jsonb_typeof(p_fields->'returnable') <> 'boolean' then
      raise exception 'E_INVALID_INPUT: returnable must be true or false' using errcode = 'P0001';
    end if;
    v_returnable := (p_fields->>'returnable')::boolean;
  end if;

  if v_old.returnable and not v_returnable then
    if exists (
      select 1
      from public.request_items ri
      join public.requests r on r.id = ri.request_id
      where ri.component_id = p_component_id
        and r.status = 'issued'
        and coalesce(ri.issued_qty, 0) > coalesce(ri.returned_qty, 0)
    ) then
      raise exception 'E_RETURNABLE_OUTSTANDING: cannot mark non-returnable while units are issued and not yet returned'
        using errcode = 'P0001';
    end if;
  end if;

  if (lower(v_name) <> lower(v_old.name)
      or coalesce(lower(v_location), '') <> coalesce(lower(v_old.location), ''))
    and exists (
      select 1 from public.components c
      where c.id <> p_component_id
        and lower(c.name) = lower(v_name)
        and coalesce(lower(c.location), '') = coalesce(lower(v_location), '')
    ) then
    raise exception 'E_DUPLICATE: a component with this name and location already exists' using errcode = 'P0001';
  end if;

  if v_name is distinct from v_old.name then
    v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', v_old.name, 'new', v_name));
  end if;
  if v_location is distinct from v_old.location then
    v_changes := v_changes || jsonb_build_object('location', jsonb_build_object('old', v_old.location, 'new', v_location));
  end if;
  if v_description is distinct from v_old.description then
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', v_old.description, 'new', v_description));
  end if;
  if v_image_url is distinct from v_old.image_url then
    v_changes := v_changes || jsonb_build_object('image_url', jsonb_build_object('old', v_old.image_url, 'new', v_image_url));
  end if;
  if v_returnable is distinct from v_old.returnable then
    v_changes := v_changes || jsonb_build_object('returnable', jsonb_build_object('old', v_old.returnable, 'new', v_returnable));
  end if;

  if v_changes = '{}'::jsonb then
    return;
  end if;

  update public.components
    set name = v_name,
        location = v_location,
        description = v_description,
        image_url = v_image_url,
        returnable = v_returnable,
        updated_by = auth.uid()
    where id = p_component_id;

  insert into public.component_edits (component_id, actor_id, changes, reason)
  values (p_component_id, auth.uid(), v_changes, nullif(trim(p_reason), ''));
end;
$$;

revoke all on function update_component(uuid, jsonb, text) from public, anon;
grant execute on function update_component(uuid, jsonb, text) to authenticated;
