-- Core tables for the Electronic Components Inventory System

create table if not exists staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role staff_role not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  count int not null default 0 check (count >= 0),
  reserved int not null default 0 check (reserved >= 0),
  returnable boolean not null default true,
  description text,
  updated_at timestamptz not null default now(),
  constraint components_reserved_le_count check (reserved <= count),
  constraint components_name_location_unique unique (name, location)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_name text,
  phone text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  public_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  project_id uuid references projects (id),
  requester_id uuid not null default auth.uid(),
  requester_name text not null,
  phone text not null,
  screenshot_path text,
  status request_status not null default 'pending',
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_at timestamptz,
  issued_at timestamptz,
  issued_by uuid,
  returned_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists request_items (
  request_id uuid not null references requests (id) on delete cascade,
  component_id uuid not null references components (id),
  qty int not null check (qty > 0),
  approved_qty int,
  issued_qty int,
  returned_qty int,
  condition item_condition,
  note text,
  primary key (request_id, component_id)
);

create table if not exists request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references requests (id) on delete cascade,
  actor_id uuid,
  from_status request_status,
  to_status request_status,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_adjustments (
  id bigint generated always as identity primary key,
  component_id uuid not null references components (id),
  old_count int,
  new_count int,
  old_reserved int,
  new_reserved int,
  reason text,
  source text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_requests_status_created on requests (status, created_at desc);
create index if not exists idx_requests_requester_created on requests (requester_id, created_at desc);
create index if not exists idx_requests_public_token on requests (public_token);
create index if not exists idx_requests_status_expires on requests (status, expires_at);
create index if not exists idx_request_items_component on request_items (component_id);
create index if not exists idx_components_name_trgm on components using gin (to_tsvector('simple', name));
create index if not exists idx_projects_phone on projects (phone);
create index if not exists idx_request_events_request_created on request_events (request_id, created_at);

-- updated_at triggers
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_components_updated_at on components;
create trigger trg_components_updated_at
  before update on components
  for each row
  execute function set_updated_at();

drop trigger if exists trg_requests_updated_at on requests;
create trigger trg_requests_updated_at
  before update on requests
  for each row
  execute function set_updated_at();
