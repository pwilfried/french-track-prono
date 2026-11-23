-- #1134: the trophies award themselves every day and are celebrated. The daily draw
-- (scripts/award-trophies.mjs, « Trophies » workflow) runs the same TypeScript as the button of
-- the back-office (src/application/trophies.ts) with the service_role key of the project; the
-- trophies that are fresh after a draw (absent before, or now in another metal) are announced:
--   * a `trophy` moment in the feed of their league: one per league for its final podium (the
--     whole podium, in data.podium, the feed gives the pseudos), one per player for a Chrono figé
--     or a Record de ligue (data.points); nothing for the general ranking and the Témoin d'or;
--   * a notification to the winner (family « Ma ligue », texts in
--     supabase/functions/_shared/push.mjs), from trophy_news.
-- Everything is published in the same transaction as the trophies; a moment is named by its key
-- and a news by its trophy and metal, so a draw run again announces nothing new. A kept trophy
-- now keeps its row (and its awarded_at): only the trophies the draw no longer gives are deleted.
-- Error codes: 42501 not an admin.

-- The service_role key already bypasses row level security and writes every table: counting it
-- as an admin gives it nothing more, and lets the daily draw call the admin functions.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false)
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

alter table league_moments drop constraint league_moments_kind_check;
alter table league_moments add constraint league_moments_kind_check
  check (kind in ('perfect_podium', 'new_leader', 'duel_result', 'mercato_win', 'badge', 'streak',
                  'trophy'));
alter table manager_moments drop constraint manager_moments_kind_check;
alter table manager_moments add constraint manager_moments_kind_check
  check (kind in ('badge', 'trophy'));

-- The fresh trophies to notify, once each (trophy and metal). Read by private.trophy_due() only.
create table trophy_news (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  season      int  not null check (season between 2000 and 2100),
  kind        text not null check (kind in ('general', 'league', 'manager', 'chrono', 'record',
                                            'witness')),
  metal       text check (metal in ('gold', 'silver', 'bronze')),
  league_id   uuid,
  league_name text check (char_length(league_name) <= 60),
  animal      text,
  -- The feat in points (Chrono figé, Record de ligue), told by the notification.
  points      int check (points >= 0),
  created_at  timestamptz not null default now()
);
create unique index trophy_news_once on trophy_news
  (user_id, season, kind, coalesce(league_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(metal, ''));
alter table trophy_news enable row level security;
revoke all on trophy_news from anon, authenticated;

-- Every trophy of a season, all players: what a draw compares itself with.
create function admin_season_trophies(p_season int)
returns table (user_id uuid, season int, kind text, metal text, league_id uuid, league_name text,
               animal text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin reads every trophy' using errcode = '42501';
  end if;
  return query
    select t.user_id, t.season, t.kind, t.metal, t.league_id, t.league_name, t.animal
    from trophies t where t.season = p_season
    order by t.user_id, t.kind, t.league_id;
end $$;
revoke execute on function admin_season_trophies(int) from public, anon;
grant execute on function admin_season_trophies(int) to authenticated;

-- Replaces every trophy of a season (p_trophies: [{user_id, kind, metal, league_id, league_name,
-- animal}]) and publishes the announcements of the draw, in one transaction:
--   p_moments: [{feed: league | manager, league_id, key, user_id, data}],
--   p_news: the fresh trophies, as p_trophies, with their points.
drop function admin_replace_trophies(int, jsonb);
create function admin_replace_trophies(p_season int, p_trophies jsonb,
                                       p_moments jsonb default '[]', p_news jsonb default '[]')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin awards the trophies' using errcode = '42501';
  end if;

  -- The trophies the draw no longer gives go; the others are added, or kept in their new metal.
  with drawn as (
    select distinct on (x.user_id, x.kind, x.league_id)
           x.user_id, x.kind, x.metal, x.league_id, left(x.league_name, 60) as league_name,
           x.animal
    from jsonb_to_recordset(coalesce(p_trophies, '[]'::jsonb))
         as x(user_id uuid, kind text, metal text, league_id uuid, league_name text, animal text)
    -- A player whose account is gone since the facts were read gets nothing.
    where exists (select 1 from profiles p where p.id = x.user_id)
  ),
  gone as (
    delete from trophies t
    where t.season = p_season
      and not exists (select 1 from drawn d
                      where d.user_id = t.user_id and d.kind = t.kind
                        and d.league_id is not distinct from t.league_id)
  )
  insert into trophies (user_id, season, kind, metal, league_id, league_name, animal)
  select d.user_id, p_season, d.kind, d.metal, d.league_id, d.league_name, d.animal from drawn d
  on conflict (user_id, season, kind,
               coalesce(league_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set metal = excluded.metal, league_name = excluded.league_name,
                animal = excluded.animal,
                awarded_at = case when trophies.metal is distinct from excluded.metal
                                  then now() else trophies.awarded_at end;

  insert into league_moments (league_id, key, kind, user_id, data)
  select m.league_id, m.key, 'trophy', m.user_id, coalesce(m.data, '{}')
  from jsonb_to_recordset(coalesce(p_moments, '[]'::jsonb))
       as m(feed text, league_id uuid, key text, user_id uuid, data jsonb)
  where m.feed = 'league'
    and exists (select 1 from leagues l where l.id = m.league_id)
    and exists (select 1 from profiles p where p.id = m.user_id)
  on conflict (league_id, key) do nothing;
  insert into manager_moments (league_id, key, kind, user_id, data)
  select m.league_id, m.key, 'trophy', m.user_id, coalesce(m.data, '{}')
  from jsonb_to_recordset(coalesce(p_moments, '[]'::jsonb))
       as m(feed text, league_id uuid, key text, user_id uuid, data jsonb)
  where m.feed = 'manager'
    and exists (select 1 from manager_leagues l where l.id = m.league_id)
    and exists (select 1 from profiles p where p.id = m.user_id)
  on conflict (league_id, key) do nothing;

  insert into trophy_news (user_id, season, kind, metal, league_id, league_name, animal, points)
  select n.user_id, p_season, n.kind, n.metal, n.league_id, left(n.league_name, 60), n.animal,
         n.points
  from jsonb_to_recordset(coalesce(p_news, '[]'::jsonb))
       as n(user_id uuid, kind text, metal text, league_id uuid, league_name text, animal text,
            points int)
  where exists (select 1 from profiles p where p.id = n.user_id)
  on conflict do nothing;
end $$;
revoke execute on function admin_replace_trophies(int, jsonb, jsonb, jsonb) from public, anon;
grant execute on function admin_replace_trophies(int, jsonb, jsonb, jsonb) to authenticated;

-- The pseudos of a podium moment (#1134): data.podium [{user_id, metal}] becomes
-- [{pseudo, metal}], without a blocked player but oneself. Other moments are left as they are.
create function trophy_moment_data(p_kind text, p_data jsonb) returns jsonb
language sql stable set search_path = public as $$
  select case when p_kind = 'trophy' and p_data ? 'podium' then
    p_data || jsonb_build_object('podium', coalesce((
      select jsonb_agg(jsonb_build_object('pseudo', pp.pseudo, 'metal', x.step ->> 'metal')
                       order by x.ord)
      from jsonb_array_elements(p_data -> 'podium') with ordinality as x(step, ord)
      join profiles pp on pp.id = (x.step ->> 'user_id')::uuid
      where pp.id = auth.uid() or not is_blocked(pp.id)), '[]'::jsonb))
  else p_data end
$$;
revoke execute on function trophy_moment_data(text, jsonb) from public, anon;
grant execute on function trophy_moment_data(text, jsonb) to authenticated;

-- As in 20261115000000_league_moments.sql, with the pseudos of a podium.
create or replace function league_feed(p_league uuid, p_limit int default 100)
returns table (key text, kind text, happened_at timestamptz, pseudo text, bib_number int,
               bib_color text, other_pseudo text, competition_name text, discipline text,
               gender text, data jsonb)
language sql stable set search_path = public as $$
  select m.key, m.kind, m.happened_at, p.pseudo, p.bib_number::int, p.bib_color, o.pseudo, c.name,
         e.discipline, e.gender::text, trophy_moment_data(m.kind, m.data)
  from league_moments m
  join profiles p on p.id = m.user_id
  left join profiles o on o.id = m.other_user_id
  left join competitions c on c.id = m.competition_id
  left join events e on e.id = m.event_id
  where m.league_id = p_league
    -- A blocked player disappears from the league for the others, their moments too.
    and (m.user_id = auth.uid() or not is_blocked(m.user_id))
  order by m.happened_at desc, m.key
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
$$;

-- As in 20261115030000_manager_moments.sql, with the pseudos of a podium.
create or replace function manager_feed(p_league uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'published', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', m.key, 'kind', m.kind, 'happened_at', m.happened_at, 'pseudo', p.pseudo,
               'bib_number', p.bib_number, 'bib_color', p.bib_color,
               'data', trophy_moment_data(m.kind, m.data))
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

alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('forgotten', 'recap', 'mercato_round', 'lineup', 'duel_over',
                  'moment_reaction', 'trash_talk', 'mercato_reveal', 'trophy'));

-- The trophy notifications due at p_now: each news of the last 48 hours (a night of quiet hours
-- included) whose trophy is still held, to a player not blocked, with a device, the « Ma ligue »
-- family on, outside their quiet hours; once per news (reminder_log.ref = its id).
create function private.trophy_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening date, ref text, payload jsonb)
language sql stable security definer set search_path = public as $$
  select n.user_id, 'trophy'::text, (n.created_at at time zone 'Europe/Paris')::date, n.id::text,
    jsonb_build_object('trophy', n.kind, 'metal', n.metal, 'animal', n.animal,
                       'season', n.season, 'league_id', n.league_id,
                       'league_name', n.league_name, 'points', n.points)
  from trophy_news n
  join profiles p on p.id = n.user_id
  left join reminder_settings r on r.user_id = n.user_id
  where n.created_at > p_now - interval '48 hours' and n.created_at <= p_now
    and p.blocked_at is null
    and coalesce(r.league, true)
    and exists (select 1 from push_subscriptions s where s.user_id = n.user_id)
    and not private.is_quiet(p_now, coalesce(r.quiet_from, 23), coalesce(r.quiet_to, 8))
    and exists (select 1 from trophies t
                where t.user_id = n.user_id and t.season = n.season and t.kind = n.kind
                  and t.league_id is not distinct from n.league_id
                  and t.metal is not distinct from n.metal)
    and not exists (select 1 from reminder_log g
                    where g.user_id = n.user_id and g.kind = 'trophy' and g.ref = n.id::text)
$$;
revoke execute on function private.trophy_due(timestamptz) from public, anon, authenticated;

-- As in 20261122160000_trash_talk.sql, with the trophies.
create or replace function private.reminder_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening text, ref text, payload jsonb, devices jsonb)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.kind, p.evening, ''::text, p.payload, p.devices
  from private.prediction_reminder_due(p_now) p
  union all
  select m.user_id, m.kind, m.evening::text, m.ref, m.payload,
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from push_subscriptions s where s.user_id = m.user_id)
  from (select * from private.manager_reminder_due(p_now)
        union all
        select * from private.moment_reaction_due(p_now)
        union all
        select * from private.mercato_reveal_due(p_now)
        union all
        select * from private.trash_talk_due(p_now)
        union all
        select * from private.trophy_due(p_now)) m
  order by 1, 2, 3, 4
$$;
revoke execute on function private.reminder_due(timestamptz) from public, anon, authenticated;
