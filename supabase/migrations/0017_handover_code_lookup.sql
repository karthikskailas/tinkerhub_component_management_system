-- Typed-code fallback for on-site staff whose camera can't scan the QR:
-- trade the 8-char request code for the handover link token.
--
-- Only approved, unexpired, not-yet-confirmed requests resolve, and the
-- lookup is rate limited per caller, so guessing codes is impractical.
-- Every miss looks the same (E_NOT_FOUND) whatever the reason.

create or replace function resolve_handover_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  perform public.check_rate_limit('handover_code', 15, 10);

  if v_code !~ '^[0-9A-F]{8}$' then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;

  select r.public_token into v_token
  from public.requests r
  where r.request_code = v_code
    and r.status = 'approved'
    and (r.expires_at is null or r.expires_at >= now())
    and r.handover_confirmed_at is null;

  if v_token is null then
    raise exception 'E_NOT_FOUND: request not found' using errcode = 'P0001';
  end if;
  return v_token;
end;
$$;

revoke all on function resolve_handover_code(text) from public, anon;
grant execute on function resolve_handover_code(text) to authenticated;
