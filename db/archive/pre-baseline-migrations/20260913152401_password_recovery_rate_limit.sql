-- Abuse protection for the public password-recovery endpoint.
-- Buckets contain only SHA-256 hashes of normalized email/IP identifiers.

create table if not exists app_private.password_recovery_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

revoke all on table app_private.password_recovery_rate_limits from public, anon, authenticated;

create or replace function public.consume_password_recovery_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
  v_count integer;
  v_started_at timestamptz;
begin
  if p_bucket_key is null or length(p_bucket_key) < 16 then
    raise exception 'Invalid rate-limit key';
  end if;
  if p_max_requests < 1 or p_max_requests > 100 then
    raise exception 'Invalid rate-limit maximum';
  end if;
  if p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit window';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into app_private.password_recovery_rate_limits as bucket (
    bucket_key, window_started_at, request_count, updated_at
  ) values (
    p_bucket_key, now(), 1, now()
  )
  on conflict (bucket_key) do update
    set window_started_at = case
          when bucket.window_started_at + v_window <= now() then now()
          else bucket.window_started_at
        end,
        request_count = case
          when bucket.window_started_at + v_window <= now() then 1
          else bucket.request_count + 1
        end,
        updated_at = now()
  returning request_count, window_started_at into v_count, v_started_at;

  return query select
    v_count <= p_max_requests,
    case
      when v_count <= p_max_requests then 0
      else greatest(1, ceil(extract(epoch from ((v_started_at + v_window) - now())))::integer)
    end;
end;
$$;

revoke all on function public.consume_password_recovery_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_password_recovery_rate_limit(text, integer, integer) to service_role;

comment on function public.consume_password_recovery_rate_limit(text, integer, integer) is
  'Server-only atomic rate limiter for password-recovery requests; bucket keys must be hashed identifiers.';
