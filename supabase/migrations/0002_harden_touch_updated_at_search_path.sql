-- Pins search_path on the trigger function so a hostile schema in front of
-- public in search_path can't shadow now()/timestamps. Pure hardening — same
-- behavior as before.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end $$;
