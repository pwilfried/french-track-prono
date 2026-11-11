-- #501: Paris time for every event time (owner's decision, 11 Nov 2026). The admin types event
-- times in Paris time whatever the country, and players read them in Paris time: the app has one
-- time zone, set in src/domain/competition.ts. A competition no longer carries its own time zone.
-- Stored instants (events.starts_at, events.lock_at) do not change: only the way they read does.

drop function admin_create_competition(text, text, text, text, text, date, date, text);
drop function admin_update_competition(text, text, text, text, text, date, date, text);

alter table competitions drop column time_zone;

-- A competition created in the back-office plays with odds.
create function admin_create_competition(
  p_slug text, p_name text, p_scope text, p_city text, p_country text,
  p_starts_on date, p_ends_on date
) returns text language plpgsql security definer set search_path = public as $$
declare
  candidate text := p_slug;
  n int := 1;
begin
  if not is_admin() then
    raise exception 'only an admin can create a competition' using errcode = '42501';
  end if;
  while exists (select 1 from competitions where slug = candidate) loop
    n := n + 1;
    candidate := p_slug || '-' || n;
  end loop;
  insert into competitions (slug, name, scope, city, country_code, starts_on, ends_on, odds_enabled)
  values (candidate, p_name, p_scope, nullif(p_city, ''), nullif(upper(p_country), ''), p_starts_on, p_ends_on,
          true);
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', candidate, 'name', p_name));
  return candidate;
end $$;

create function admin_update_competition(
  p_slug text, p_name text, p_scope text, p_city text, p_country text,
  p_starts_on date, p_ends_on date
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit a competition' using errcode = '42501';
  end if;
  update competitions
  set name = p_name, scope = p_scope, city = nullif(p_city, ''), country_code = nullif(upper(p_country), ''),
      starts_on = p_starts_on, ends_on = p_ends_on
  where slug = p_slug;
  if not found then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', p_slug, 'name', p_name, 'edited', true));
end $$;

revoke execute on function admin_create_competition(text, text, text, text, text, date, date) from public, anon;
revoke execute on function admin_update_competition(text, text, text, text, text, date, date) from public, anon;
grant execute on function admin_create_competition(text, text, text, text, text, date, date) to authenticated, service_role;
grant execute on function admin_update_competition(text, text, text, text, text, date, date) to authenticated, service_role;
