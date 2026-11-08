-- v0.9 (#267): a league counts one or several competitions, chosen by its creator; its ranking
-- adds up the points of all of them. Error codes: 22023 no competition, P0002 unknown competition,
-- 42501 not signed in.

drop function create_league(text, text);

create function create_league(p_name text, p_competition_slugs text[])
returns table (league_id uuid, invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_code text;
  v_wanted int := (select count(distinct s) from unnest(p_competition_slugs) s);
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if coalesce(v_wanted, 0) = 0 then
    raise exception 'choose at least one competition' using errcode = '22023';
  end if;
  if (select count(*) from competitions where slug = any(p_competition_slugs)) <> v_wanted then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  insert into leagues (name, owner_id) values (trim(p_name), auth.uid())
  returning id, leagues.invite_code into v_league, v_code;
  insert into league_members (league_id, user_id, role) values (v_league, auth.uid(), 'owner');
  insert into league_competitions (league_id, competition_id)
  select v_league, c.id from competitions c where c.slug = any(p_competition_slugs);
  return query select v_league, v_code;
end $$;

revoke execute on function create_league(text, text[]) from public, anon;
grant execute on function create_league(text, text[]) to authenticated;

-- The pages now take the time zone from the database: the European Championships, when loaded
-- (supabase/data), run on London time.
update competitions set time_zone = 'Europe/London' where slug = 'european-championships-2026';
