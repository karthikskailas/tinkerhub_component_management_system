-- Phase 4.3: admin-defined component fields as real typed columns.
--
-- component_fields holds the definitions (core rows exist only so their
-- labels / visibility are editable). create_component_field is the single,
-- locked-down place that runs ALTER TABLE: key is validated snake_case, type
-- is whitelisted, identifiers go through %I. Deleting a field only archives
-- it (data kept); renaming changes the label only.

create table if not exists component_fields (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (char_length(trim(label)) between 1 and 60),
  type text not null check (type in ('text', 'int', 'numeric', 'bool')),
  max_length int check (max_length is null or max_length between 1 and 500),
  sort int not null default 0,
  show_in_table boolean not null default false,
  searchable boolean not null default false,
  archived boolean not null default false,
  is_core boolean not null default false,
  created_at timestamptz not null default now()
);

insert into component_fields (key, label, type, max_length, sort, show_in_table, is_core) values
  ('name', 'Name', 'text', 200, 1, true, true),
  ('count', 'Count', 'int', null, 2, true, true),
  ('location', 'Location', 'text', 200, 3, true, true),
  ('description', 'Description', 'text', 500, 4, true, true),
  ('returnable', 'Returnable', 'bool', null, 5, true, true)
on conflict (key) do nothing;

alter table component_fields enable row level security;
drop policy if exists component_fields_select_staff on component_fields;
create policy component_fields_select_staff on component_fields
  for select to authenticated using (is_staff());
grant select on component_fields to authenticated;

-- ============================================================
-- value helpers (used by upload + update_component)
-- ============================================================
create or replace function _field_value(p_type text, p_max int, p_raw text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(trim(p_raw), '') is null then null
    when p_type = 'text' then
      case when char_length(trim(p_raw)) <= coalesce(p_max, 200) then to_jsonb(trim(p_raw)) end
    when p_type = 'int' then
      case when trim(p_raw) ~ '^-?[0-9]{1,9}$' then to_jsonb(trim(p_raw)::int) end
    when p_type = 'numeric' then
      case when trim(p_raw) ~ '^-?[0-9]{1,12}(\.[0-9]{1,6})?$' then to_jsonb(trim(p_raw)::numeric) end
    when p_type = 'bool' then
      case when lower(trim(p_raw)) in ('yes', 'true', '1', 'y') then 'true'::jsonb
           when lower(trim(p_raw)) in ('no', 'false', '0', 'n') then 'false'::jsonb end
  end;
$$;

create or replace function _field_invalid(p_type text, p_max int, p_raw text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(p_raw), '') is not null and public._field_value(p_type, p_max, p_raw) is null;
$$;

revoke all on function _field_value(text, int, text) from public, anon;
revoke all on function _field_invalid(text, int, text) from public, anon;
grant execute on function _field_value(text, int, text) to authenticated;
grant execute on function _field_invalid(text, int, text) to authenticated;

-- ============================================================
-- create_component_field (admin)
-- ============================================================
create or replace function create_component_field(
  p_label text,
  p_type text default 'text',
  p_max_length int default null,
  p_searchable boolean default false,
  p_key text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := trim(p_label);
  v_key text;
  v_sql_type text;
  v_max int;
  v_trgm_schema text;
begin
  if not public.is_admin() then
    raise exception 'E_FORBIDDEN: admin role required' using errcode = 'P0001';
  end if;

  if v_label is null or v_label = '' or char_length(v_label) > 60 then
    raise exception 'E_INVALID_INPUT: field name is required (max 60 characters)' using errcode = 'P0001';
  end if;
  if p_type not in ('text', 'int', 'numeric', 'bool') then
    raise exception 'E_INVALID_INPUT: type must be text, int, numeric or bool' using errcode = 'P0001';
  end if;

  v_key := coalesce(nullif(trim(p_key), ''), trim(both '_' from regexp_replace(lower(v_label), '[^a-z0-9]+', '_', 'g')));
  if v_key ~ '^[0-9]' then v_key := 'f_' || v_key; end if;
  v_key := left(v_key, 40);
  if v_key !~ '^[a-z][a-z0-9_]{0,39}$' then
    raise exception 'E_INVALID_INPUT: field name must contain letters or digits' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'components' and column_name = v_key
  ) or exists (select 1 from public.component_fields where key = v_key) then
    raise exception 'E_DUPLICATE: a field with this name already exists' using errcode = 'P0001';
  end if;

  if (select count(*) from public.component_fields where not is_core) >= 20 then
    raise exception 'E_INVALID_INPUT: at most 20 custom fields are allowed' using errcode = 'P0001';
  end if;

  v_sql_type := case p_type when 'text' then 'text' when 'int' then 'integer'
                            when 'numeric' then 'numeric' else 'boolean' end;
  v_max := case when p_type = 'text' then least(coalesce(p_max_length, 200), 500) end;

  execute format('alter table public.components add column %I %s', v_key, v_sql_type);

  if p_searchable and p_type = 'text' then
    select n.nspname into v_trgm_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
    execute format(
      'create index %I on public.components using gin (%I %I.gin_trgm_ops)',
      'idx_components_' || v_key || '_trgm', v_key, v_trgm_schema
    );
  end if;

  insert into public.component_fields (key, label, type, max_length, sort, show_in_table, searchable)
  values (
    v_key, v_label, p_type, v_max,
    coalesce((select max(sort) from public.component_fields), 0) + 1,
    true, coalesce(p_searchable, false) and p_type = 'text'
  );

  return v_key;
end;
$$;

revoke all on function create_component_field(text, text, int, boolean, text) from public, anon;
grant execute on function create_component_field(text, text, int, boolean, text) to authenticated;

-- ============================================================
-- update_component_field (admin): label / table visibility / search /
-- archive. Core rows only accept label + show_in_table.
-- ============================================================
create or replace function update_component_field(
  p_key text,
  p_label text default null,
  p_show_in_table boolean default null,
  p_searchable boolean default null,
  p_archived boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.component_fields%rowtype;
  v_label text;
  v_trgm_schema text;
begin
  if not public.is_admin() then
    raise exception 'E_FORBIDDEN: admin role required' using errcode = 'P0001';
  end if;

  select * into v_f from public.component_fields where key = p_key for update;
  if not found then
    raise exception 'E_NOT_FOUND: field not found' using errcode = 'P0001';
  end if;

  v_label := coalesce(nullif(trim(p_label), ''), v_f.label);
  if char_length(v_label) > 60 then
    raise exception 'E_INVALID_INPUT: field name is too long (max 60 characters)' using errcode = 'P0001';
  end if;

  if v_f.is_core and (p_searchable is not null or p_archived is not null) then
    raise exception 'E_INVALID_INPUT: built-in fields can only be renamed or hidden from the table'
      using errcode = 'P0001';
  end if;

  if not v_f.is_core and p_searchable is not null and p_searchable is distinct from v_f.searchable then
    if p_searchable and v_f.type <> 'text' then
      raise exception 'E_INVALID_INPUT: only text fields can be searchable' using errcode = 'P0001';
    end if;
    if p_searchable then
      select n.nspname into v_trgm_schema
      from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
      execute format(
        'create index if not exists %I on public.components using gin (%I %I.gin_trgm_ops)',
        'idx_components_' || v_f.key || '_trgm', v_f.key, v_trgm_schema
      );
    else
      execute format('drop index if exists public.%I', 'idx_components_' || v_f.key || '_trgm');
    end if;
  end if;

  update public.component_fields
    set label = v_label,
        show_in_table = coalesce(p_show_in_table, show_in_table),
        searchable = coalesce(p_searchable, searchable),
        archived = coalesce(p_archived, archived)
    where key = p_key;
end;
$$;

revoke all on function update_component_field(text, text, boolean, boolean, boolean) from public, anon;
grant execute on function update_component_field(text, text, boolean, boolean, boolean) to authenticated;

-- ============================================================
-- Upload RPCs: rows may carry custom-field keys at top level. The return
-- type gains old_attributes/new_attributes, so the functions are dropped
-- and recreated. Blank custom cells never erase stored values.
-- ============================================================
drop function if exists preview_inventory_upload(jsonb);
drop function if exists commit_inventory_upload(jsonb, text);

create function preview_inventory_upload(p_rows jsonb)
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

create function commit_inventory_upload(p_rows jsonb, p_reason text)
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

-- ============================================================
-- update_component: now also accepts active custom-field keys.
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
  v_custom jsonb := '{}'::jsonb;
  v_f record;
  v_new jsonb;
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
      and not exists (
        select 1 from public.component_fields f
        where f.key = k and not f.is_core and not f.archived
      )
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

  -- Custom fields: blank clears, otherwise must satisfy the field's type.
  for v_f in
    select f.key, f.type, f.max_length, f.label
    from public.component_fields f
    where not f.is_core and not f.archived and p_fields ? f.key
  loop
    if public._field_invalid(v_f.type, v_f.max_length, p_fields->>v_f.key) then
      raise exception 'E_INVALID_INPUT: % has an invalid value', v_f.label using errcode = 'P0001';
    end if;
    v_new := public._field_value(v_f.type, v_f.max_length, p_fields->>v_f.key);
    if v_new is distinct from nullif(to_jsonb(v_old) -> v_f.key, 'null'::jsonb) then
      v_changes := v_changes || jsonb_build_object(
        v_f.key,
        jsonb_build_object('old', to_jsonb(v_old) -> v_f.key, 'new', v_new)
      );
      v_custom := v_custom || jsonb_build_object(v_f.key, v_new);
    end if;
  end loop;

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

  for v_f in select key from public.component_fields where not is_core and v_custom ? key
  loop
    execute format(
      'update public.components
         set %1$I = (jsonb_populate_record(null::public.components, $1)).%1$I
       where id = $2',
      v_f.key
    ) using jsonb_build_object(v_f.key, v_custom -> v_f.key), p_component_id;
  end loop;

  insert into public.component_edits (component_id, actor_id, changes, reason)
  values (p_component_id, auth.uid(), v_changes, nullif(trim(p_reason), ''));
end;
$$;

revoke all on function update_component(uuid, jsonb, text) from public, anon;
grant execute on function update_component(uuid, jsonb, text) to authenticated;
