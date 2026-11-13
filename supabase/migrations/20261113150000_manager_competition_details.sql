-- #663: the competition picker of a Manager league groups, filters and selects by city, scope,
-- venue and level. The two lists of competitions also answer them (columns added at the end).
-- private.manager_chosen_competitions() reads list_manager_available_competitions() by column
-- name: it keeps working.

drop function list_manager_available_competitions();
drop function list_manager_league_competitions(uuid);

-- The competitions a league can be created with: eligible and not finished, first one first.
create function list_manager_available_competitions()
returns table (competition_id uuid, name text, first_event_at timestamptz, city text, scope text,
               venue text, level text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, private.manager_first_event(c.id), c.city, c.scope, c.venue, c.level
  from manager_competitions mc
  join competitions c on c.id = mc.competition_id
  where c.status <> 'finished'
  order by 3, c.name
$$;
revoke execute on function list_manager_available_competitions() from public, anon;
grant execute on function list_manager_available_competitions() to authenticated;

-- The competitions of a league, first one first, for its participants only.
create function list_manager_league_competitions(p_league uuid)
returns table (competition_id uuid, name text, first_event_at timestamptz, city text, scope text,
               venue text, level text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, private.manager_first_event(c.id), c.city, c.scope, c.venue, c.level
  from manager_leagues l
  cross join lateral unnest(l.competition_ids) as e(id)
  join competitions c on c.id = e.id
  where l.id = p_league and is_manager_member(l.id)
  order by 3, c.name
$$;
revoke execute on function list_manager_league_competitions(uuid) from public, anon;
grant execute on function list_manager_league_competitions(uuid) to authenticated;
