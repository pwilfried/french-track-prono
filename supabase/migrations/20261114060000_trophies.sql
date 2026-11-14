-- Season trophies (#822), rules of docs/decisions/badges-et-trophees.md (#807): statuettes for the
-- final rankings (a predictions league, a Manager league, the general ranking) and three feats
-- (Chrono figé, Record de ligue, Témoin d'or), one shelf per season in the player's showcase.
-- The trophies are drawn in TypeScript (src/domain/trophies.ts, as the points: decision B) by the
-- admin from the back-office: admin_trophy_facts() gives what they are drawn from (the score lines
-- are read as for the rankings), admin_replace_trophies() replaces the trophies of a season in one
-- go, so drawing them again never duplicates one.
-- The FrenchTrack account of the Témoin d'or is set by the admin (admin_set_trophy_witness);
-- without one, the trophy is not offered.

create table trophies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  season      int  not null check (season between 2000 and 2100),
  kind        text not null check (kind in ('general', 'league', 'manager', 'chrono', 'record',
                                            'witness')),
  metal       text check (metal in ('gold', 'silver', 'bronze')),
  -- The predictions or Manager league, without a foreign key: the trophy stays when the league is
  -- deleted, with the name it had when it was won.
  league_id   uuid,
  league_name text check (char_length(league_name) <= 60),
  animal      text check (animal in ('cheetah', 'impala', 'hare', 'kangaroo', 'cat', 'bear', 'fox')),
  awarded_at  timestamptz not null default now(),
  -- A ranking gives a metal, a feat none; the general ranking and the Témoin d'or have no league.
  check ((kind in ('general', 'league', 'manager')) = (metal is not null)),
  check ((kind in ('general', 'witness')) = (league_id is null))
);
create unique index trophies_once on trophies
  (user_id, season, kind, coalesce(league_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- True when the signed-in player and p_user play in the same predictions or Manager league.
create function shares_a_league(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members a join league_members b using (league_id)
                 where a.user_id = auth.uid() and b.user_id = p_user)
      or exists (select 1 from manager_members a join manager_members b using (league_id)
                 where a.user_id = auth.uid() and b.user_id = p_user)
$$;
revoke execute on function shares_a_league(uuid) from public, anon;
grant execute on function shares_a_league(uuid) to authenticated;

-- A player reads their trophies, and those of the players of their leagues (#807); nobody writes.
alter table trophies enable row level security;
create policy read_own_or_league on trophies for select to authenticated
  using (user_id = auth.uid() or shares_a_league(user_id));
revoke insert, update, delete, truncate on trophies from anon, authenticated;

-- One row: the FrenchTrack account of the Témoin d'or. Read and written by the admin functions.
create table trophy_settings (
  id         boolean primary key default true check (id),
  witness_id uuid references profiles(id) on delete set null
);
insert into trophy_settings default values;
alter table trophy_settings enable row level security;
revoke all on trophy_settings from anon, authenticated;

-- The pseudo of the FrenchTrack account, null when none is set.
create function admin_trophy_witness() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin reads the trophy settings' using errcode = '42501';
  end if;
  return (select p.pseudo from trophy_settings s join profiles p on p.id = s.witness_id);
end $$;
revoke execute on function admin_trophy_witness() from public, anon;
grant execute on function admin_trophy_witness() to authenticated;

-- Sets the FrenchTrack account by its pseudo (any case), or none with an empty one. Returns
-- 'saved', 'cleared' or 'unknown' (no player with this pseudo: nothing changes).
create function admin_set_trophy_witness(p_pseudo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if not is_admin() then
    raise exception 'only an admin sets the trophy settings' using errcode = '42501';
  end if;
  if coalesce(btrim(p_pseudo), '') = '' then
    update trophy_settings set witness_id = null;
    return 'cleared';
  end if;
  select id into v_user from profiles where lower(pseudo) = lower(btrim(p_pseudo));
  if v_user is null then
    return 'unknown';
  end if;
  update trophy_settings set witness_id = v_user;
  return 'saved';
end $$;
revoke execute on function admin_set_trophy_witness(text) from public, anon;
grant execute on function admin_set_trophy_witness(text) to authenticated;

-- What the trophies of a season are drawn from, but the score lines:
-- { witness_id,
--   competitions: [{slug, ends_on}]  -- those ending in the season and those of its leagues,
--   leagues: [{id, name, members: [{user_id, joined_at}],
--              competitions: [{slug, ends_on, added_at}], families: [{family, added_at}]}],
--   manager: [{league_id, league_name, ended_at, standings: [{user_id, rank}]}] }
-- A predictions league belongs to the season its last competition ends in; a Manager league to
-- the one its season ended in, Paris time.
create function admin_trophy_facts(p_season int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'only an admin draws the trophies' using errcode = '42501';
  end if;
  with season_leagues as (
    select lc.league_id
    from league_competitions lc join competitions c on c.id = lc.competition_id
    group by lc.league_id
    having extract(year from max(c.ends_on))::int = p_season
  ),
  league_json as (
    select jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id,
                                                               'joined_at', m.joined_at)
                                            order by m.joined_at, m.user_id)
                           from league_members m where m.league_id = l.id), '[]'::jsonb),
      'competitions', (select jsonb_agg(jsonb_build_object('slug', c.slug, 'ends_on', c.ends_on,
                                                           'added_at', lc.added_at)
                                        order by c.ends_on, c.slug)
                       from league_competitions lc join competitions c on c.id = lc.competition_id
                       where lc.league_id = l.id),
      'families', coalesce((select jsonb_agg(jsonb_build_object('family', f.family,
                                                                'added_at', f.added_at)
                                             order by f.family)
                            from league_families f where f.league_id = l.id), '[]'::jsonb)
    ) as j
    from leagues l join season_leagues s on s.league_id = l.id
  )
  select jsonb_build_object(
    'witness_id', (select witness_id from trophy_settings),
    'competitions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'ends_on', c.ends_on)
                       order by c.ends_on, c.slug)
      from competitions c
      where extract(year from c.ends_on)::int = p_season
         or exists (select 1 from league_competitions lc join season_leagues s using (league_id)
                    where lc.competition_id = c.id)), '[]'::jsonb),
    'leagues', coalesce((select jsonb_agg(j) from league_json), '[]'::jsonb),
    'manager', coalesce((
      select jsonb_agg(jsonb_build_object(
               'league_id', h.league_id,
               'league_name', coalesce(ml.name, ''),
               'ended_at', h.ended_at,
               'standings', (select jsonb_agg(jsonb_build_object('user_id', x ->> 'user_id',
                                                                 'rank', (x ->> 'rank')::int))
                             from jsonb_array_elements(h.standings) x))
             order by h.ended_at, h.league_id)
      from manager_honours h left join manager_leagues ml on ml.id = h.league_id
      where extract(year from h.ended_at at time zone 'Europe/Paris')::int = p_season), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke execute on function admin_trophy_facts(int) from public, anon;
grant execute on function admin_trophy_facts(int) to authenticated;

-- Replaces every trophy of a season in one transaction (delete + insert): drawing them again
-- never duplicates one. p_trophies: [{user_id, kind, metal, league_id, league_name, animal}].
create function admin_replace_trophies(p_season int, p_trophies jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin awards the trophies' using errcode = '42501';
  end if;
  delete from trophies where season = p_season;
  insert into trophies (user_id, season, kind, metal, league_id, league_name, animal)
  select (t ->> 'user_id')::uuid, p_season, t ->> 'kind', t ->> 'metal',
         (t ->> 'league_id')::uuid, left(t ->> 'league_name', 60), t ->> 'animal'
  from jsonb_array_elements(coalesce(p_trophies, '[]'::jsonb)) t
  -- A player whose account is gone since the facts were read gets nothing.
  where exists (select 1 from profiles p where p.id = (t ->> 'user_id')::uuid)
  on conflict do nothing;
end $$;
revoke execute on function admin_replace_trophies(int, jsonb) from public, anon;
grant execute on function admin_replace_trophies(int, jsonb) to authenticated;
