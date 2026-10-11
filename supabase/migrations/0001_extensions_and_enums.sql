-- Extensions and enums for the Electronic Components Inventory System

create extension if not exists pgcrypto;

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
