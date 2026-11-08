-- Start list import (v0.8): an admin adds an athlete unknown so far. The slug comes from the app
-- ("gemima-joseph"); when it is taken, a number is added ("gemima-joseph-2").
create function create_athlete(p_name text, p_country text, p_gender text, p_slug text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  candidate text := p_slug;
  n int := 1;
  id uuid;
begin
  if not is_admin() then
    raise exception 'only an admin can add an athlete' using errcode = '42501';
  end if;
  while exists (select 1 from athletes where slug = candidate) loop
    n := n + 1;
    candidate := p_slug || '-' || n;
  end loop;
  insert into athletes (slug, name, country_code, gender)
  values (candidate, p_name, upper(p_country), p_gender)
  returning athletes.id into id;
  return id;
end $$;

revoke execute on function create_athlete(text, text, text, text) from public, anon;
grant execute on function create_athlete(text, text, text, text) to authenticated;
