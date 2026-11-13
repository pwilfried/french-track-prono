-- #642: a competition is indoor (« en salle ») or outdoor (« en plein air »), outdoor by default.
-- Season bests and events differ between the two (60 m, 60 m hurdles, 3000 m indoors).
-- Existing competitions: the World Indoor Tour and the European Indoor Championships are indoor,
-- every other one stays outdoor.

alter table competitions
  add column venue text not null default 'outdoor' check (venue in ('indoor', 'outdoor'));

-- The venue of a competition already in base, read from its slug (tested in pgTAP).
create function private.competition_venue(p_slug text) returns text
language sql immutable set search_path = public as $$
  select case when p_slug like 'world-indoor-tour-%' or p_slug like 'european-indoor-championships-%'
              then 'indoor' else 'outdoor' end
$$;

update competitions set venue = private.competition_venue(slug);

drop function admin_create_competition(text, text, text, text, text, date, date);
drop function admin_update_competition(text, text, text, text, text, date, date);

-- A competition created in the back-office plays with odds.
create function admin_create_competition(
  p_slug text, p_name text, p_scope text, p_city text, p_country text,
  p_starts_on date, p_ends_on date, p_venue text default 'outdoor'
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
  insert into competitions (slug, name, scope, venue, city, country_code, starts_on, ends_on, odds_enabled)
  values (candidate, p_name, p_scope, coalesce(p_venue, 'outdoor'), nullif(p_city, ''),
          nullif(upper(p_country), ''), p_starts_on, p_ends_on, true);
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', candidate, 'name', p_name));
  return candidate;
end $$;

create function admin_update_competition(
  p_slug text, p_name text, p_scope text, p_city text, p_country text,
  p_starts_on date, p_ends_on date, p_venue text default 'outdoor'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit a competition' using errcode = '42501';
  end if;
  update competitions
  set name = p_name, scope = p_scope, venue = coalesce(p_venue, 'outdoor'), city = nullif(p_city, ''),
      country_code = nullif(upper(p_country), ''), starts_on = p_starts_on, ends_on = p_ends_on
  where slug = p_slug;
  if not found then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', p_slug, 'name', p_name, 'edited', true));
end $$;

revoke execute on function admin_create_competition(text, text, text, text, text, date, date, text) from public, anon;
revoke execute on function admin_update_competition(text, text, text, text, text, date, date, text) from public, anon;
grant execute on function admin_create_competition(text, text, text, text, text, date, date, text) to authenticated, service_role;
grant execute on function admin_update_competition(text, text, text, text, text, date, date, text) to authenticated, service_role;
