-- Extensions and enums for the Electronic Components Inventory System

-- Supabase hosted projects pre-install pgcrypto into the `extensions`
-- schema (not `public`), and CREATE EXTENSION IF NOT EXISTS is a no-op
-- whenever the extension already exists anywhere, regardless of this
-- SCHEMA clause. Pin it explicitly so gen_random_bytes() can be called as
-- extensions.gen_random_bytes(...) consistently in later migrations,
-- whether this runs against a fresh local db or an existing cloud project.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type staff_role as enum ('admin', 'inventory_manager');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type request_status as enum (
      'pending', 'approved', 'issued', 'returned', 'rejected', 'cancelled', 'expired'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'item_condition') then
    create type item_condition as enum ('ok', 'damaged', 'missing');
  end if;
end $$;
