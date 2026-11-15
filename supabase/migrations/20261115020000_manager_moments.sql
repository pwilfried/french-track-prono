-- v0.19 (#875): the feed of a Manager league, and badge moments in every feed. A Manager league
-- tells the athletes won at the reveal of each mercato round (manager_round_bids) and the result
-- of each head-to-head once its matchday is scored (manager_fixtures, manager_scores): these
-- facts are already stored, src/domain/manager-moments.ts tells them, with a stable key per fact.
-- A badge level won leaves no dated trace elsewhere: it is published, once per player, badge and
-- level, in league_moments for the prediction leagues of the player and in manager_moments, the
-- twin table, for their Manager leagues. No text is stored: src/app/messages.fr.ts writes the
-- sentences. Error codes: 42501 not signed in.

create table manager_moments (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references manager_leagues(id) on delete cascade,
  -- Names the fact, e.g. badge:<player>:<badge>:<level>: one moment per fact and league.
  key         text not null check (length(key) between 1 and 200),
  -- Mercato wins and duel results are read from their own tables: only badges are stored.
  kind        text not null check (kind in ('badge')),
  user_id     uuid not null references profiles(id) on delete cascade,
  data        jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  happened_at timestamptz not null default now(),
  unique (league_id, key)
);
create index on manager_moments (league_id, happened_at desc);

-- A participant reads the moments of their Manager leagues; nobody writes outside the function
-- below.
alter table manager_moments enable row level security;
create policy members_read on manager_moments for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_moments from anon, authenticated;

-- The signed-in player tells the badge levels they have just won: [{key, badge, level}]. Only a
-- level they hold (user_badges, raised first by raise_my_badge_levels) under its own key
-- (badge:<player>:<badge>:<level>) is published, in each of their leagues, prediction and
-- Manager. A fact already told is kept once. Returns how many moments are new.
create function publish_my_badge_moments(p_moments jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  with won as (
    select x.key, x.badge, x.level
    from jsonb_to_recordset(p_moments) as x(key text, badge text, level text)
    join user_badges ub on ub.user_id = v_user and ub.badge_code = x.badge
    where x.key = 'badge:' || v_user || ':' || x.badge || ':' || x.level
      and array_position(array['bronze', 'silver', 'gold'], ub.level)
          >= array_position(array['bronze', 'silver', 'gold'], x.level)
  ),
  predictions as (
    insert into league_moments (league_id, key, kind, user_id, data)
    select lm.league_id, w.key, 'badge', v_user,
           jsonb_build_object('badge', w.badge, 'level', w.level)
    from won w cross join league_members lm
    where lm.user_id = v_user
    on conflict (league_id, key) do nothing
    returning 1
  ),
  manager as (
    insert into manager_moments (league_id, key, kind, user_id, data)
    select mm.league_id, w.key, 'badge', v_user,
           jsonb_build_object('badge', w.badge, 'level', w.level)
    from won w cross join manager_members mm
    where mm.user_id = v_user
    on conflict (league_id, key) do nothing
    returning 1
  )
  select (select count(*) from predictions) + (select count(*) from manager) into v_count;
  return v_count;
end $$;
revoke execute on function publish_my_badge_moments(jsonb) from public, anon;
grant execute on function publish_my_badge_moments(jsonb) to authenticated;

-- What the feed of a Manager league tells: {published, wins, duels}, with the players' pseudo
-- and bib only (decision of the owner, 14 Nov 2026). A duel is told once its matchday has scores
-- (a missing score counts 0, as in the standings); bonus matchdays have no duel. Security
-- invoker: row level security shows someone outside the league nothing.
create function manager_feed(p_league uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'published', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', m.key, 'kind', m.kind, 'happened_at', m.happened_at, 'pseudo', p.pseudo,
               'bib_number', p.bib_number, 'bib_color', p.bib_color, 'data', m.data)
             order by m.happened_at desc, m.key)
      from manager_moments m
      join profiles p on p.id = m.user_id
      where m.league_id = p_league
        -- A blocked player disappears from the league for the others, their moments too.
        and (m.user_id = auth.uid() or not is_blocked(m.user_id))), '[]'),
    'wins', coalesce((
      select jsonb_agg(jsonb_build_object(
               'round', b.round, 'athlete_id', b.athlete_id, 'athlete', a.name, 'price', b.amount,
               'user_id', b.user_id, 'pseudo', p.pseudo, 'bib_number', p.bib_number,
               'bib_color', p.bib_color, 'closed_at', r.closed_at)
             order by b.round, b.athlete_id)
      from manager_round_bids b
      join manager_rounds r on r.league_id = b.league_id and r.round = b.round
      join athletes a on a.id = b.athlete_id
      join profiles p on p.id = b.user_id
      where b.league_id = p_league and b.won), '[]'),
    'duels', coalesce((
      select jsonb_agg(jsonb_build_object(
               'round', f.round, 'competition_name', c.name, 'scored_at', sc.at,
               'home', jsonb_build_object('user_id', f.home_id, 'pseudo', hp.pseudo,
                                          'bib_number', hp.bib_number, 'bib_color', hp.bib_color,
                                          'score', coalesce(h.total, 0)),
               'away', jsonb_build_object('user_id', f.away_id, 'pseudo', ap.pseudo,
                                          'bib_number', ap.bib_number, 'bib_color', ap.bib_color,
                                          'score', coalesce(a.total, 0)))
             order by f.round, f.home_id)
      from manager_fixtures f
      join manager_matchdays d on d.league_id = f.league_id and d.round = f.round
      join competitions c on c.id = d.competition_id
      join profiles hp on hp.id = f.home_id
      join profiles ap on ap.id = f.away_id
      cross join lateral (select max(s.computed_at) as at from manager_scores s
                          where s.league_id = f.league_id
                            and s.competition_id = d.competition_id) sc
      left join manager_scores h
        on h.league_id = f.league_id and h.competition_id = d.competition_id
       and h.user_id = f.home_id
      left join manager_scores a
        on a.league_id = f.league_id and a.competition_id = d.competition_id
       and a.user_id = f.away_id
      where f.league_id = p_league and not d.bonus and sc.at is not null), '[]'))
$$;
revoke execute on function manager_feed(uuid) from public, anon;
grant execute on function manager_feed(uuid) to authenticated;
