-- #1156: « Résultats du soir » also tells the player's place in their main league on the evening,
-- and leads to the league result of the last final of the evening (#1155).
--
-- Main league: one that counts the competition of a final of the evening and to which the player
-- added a prediction of the evening; the one with the most members, the oldest on a tie. Its
-- points of the evening are counted as in its ranking (admin_league_members, trash talk): the
-- predictions added to the league, jokers included, on events locked after the member joined;
-- blocked players are left out. The rank is among the members who scored a final of the evening
-- in the league. Without such a league, the payload has no league and the text is unchanged.
--
-- private.prediction_reminder_due() of 20261123090000_remind_league_competitions.sql with the
-- league added to the recap payload; the rest is unchanged.

create or replace function private.prediction_reminder_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening text, payload jsonb, devices jsonb)
language sql stable security definer set search_path = public as $$
  with players as (
    -- Not blocked, with a device, outside their quiet hours.
    select p.id as user_id,
      coalesce(r.forgotten, true) as forgotten,
      coalesce(r.evening_results, true) as evening_results,
      coalesce(r.lead_minutes, 60) as lead_minutes
    from profiles p
    left join reminder_settings r on r.user_id = p.id
    where p.blocked_at is null
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not private.is_quiet(p_now, coalesce(r.quiet_from, 23), coalesce(r.quiet_to, 8))
  ),
  missing as (
    -- Predictable finals locking within the lead, without the player's podium, in a competition
    -- they play or one of their leagues counts, on an evening not reminded yet.
    select pl.user_id, e.slug, e.discipline, e.gender, e.lock_at,
      (e.lock_at at time zone 'Europe/Paris')::date as evening
    from players pl
    join events e on e.lock_at > p_now
                 and e.lock_at <= p_now + make_interval(mins => pl.lead_minutes)
    where pl.forgotten
      and is_predictable(e.id)
      and (exists (select 1 from predictions p
                   where p.user_id = pl.user_id and p.competition_id = e.competition_id)
           or exists (select 1 from league_members lm
                      join league_competitions lc on lc.league_id = lm.league_id
                      where lm.user_id = pl.user_id and lc.competition_id = e.competition_id))
      and not exists (select 1 from predictions p where p.user_id = pl.user_id and p.event_id = e.id)
      and not exists (select 1 from reminder_log l
                      where l.user_id = pl.user_id and l.kind = 'forgotten'
                        and l.evening = (e.lock_at at time zone 'Europe/Paris')::date)
  ),
  forgotten as (
    -- One message for all of them; the first evening only if the window spans two.
    select distinct on (g.user_id) g.user_id, g.evening, g.payload
    from (
      select m.user_id, m.evening,
        jsonb_build_object('events', jsonb_agg(jsonb_build_object(
          'slug', m.slug, 'discipline', m.discipline, 'gender', m.gender, 'lock_at', m.lock_at)
          order by m.lock_at, m.slug)) as payload
      from missing m
      group by m.user_id, m.evening
    ) g
    order by g.user_id, g.evening
  ),
  evening_predictions as (
    -- The finals the player predicted on the last evenings, with their points once computed.
    select pl.user_id, (e.starts_at at time zone 'Europe/Paris')::date as evening,
      e.competition_id, e.starts_at, se.points, se.created_at as scored_at
    from players pl
    join predictions pr on pr.user_id = pl.user_id
    join events e on e.id = pr.event_id
    left join score_events se
      on se.user_id = pl.user_id and se.event_id = e.id and se.source = 'prediction'
    where pl.evening_results
      and (e.starts_at at time zone 'Europe/Paris')::date
          >= (p_now at time zone 'Europe/Paris')::date - 2
      and e.starts_at <= p_now + interval '2 days'
  ),
  recap as (
    -- Every final of the evening has its points, the last ones computed less than 24 hours ago.
    select ep.user_id, ep.evening, sum(ep.points)::int as points, count(*)::int as finals,
      (array_agg(ep.competition_id order by ep.starts_at desc))[1] as competition_id
    from evening_predictions ep
    where not exists (select 1 from reminder_log l
                      where l.user_id = ep.user_id and l.kind = 'recap' and l.evening = ep.evening)
    group by ep.user_id, ep.evening
    having bool_and(ep.points is not null) and max(ep.scored_at) > p_now - interval '24 hours'
  ),
  league_scores as (
    -- What counts in a league on the last evenings, for each member: the predictions they added
    -- to it, with their points (joker included), on events locked after they joined.
    select lp.league_id, lp.user_id, (e.starts_at at time zone 'Europe/Paris')::date as evening,
      e.slug, e.starts_at, coalesce((s.detail -> 'jokers' ->> jp.kind)::int, s.points) as points
    from league_predictions lp
    join league_members m on m.league_id = lp.league_id and m.user_id = lp.user_id
    join profiles p on p.id = lp.user_id and p.blocked_at is null
    join events e on e.id = lp.event_id and e.lock_at >= m.joined_at
    join league_competitions lc on lc.league_id = lp.league_id
                               and lc.competition_id = e.competition_id
    join score_events s on s.user_id = lp.user_id and s.event_id = lp.event_id
                       and s.source = 'prediction'
    left join league_joker_plays jp on jp.league_id = lp.league_id and jp.user_id = lp.user_id
                                   and jp.event_id = lp.event_id
    where (e.starts_at at time zone 'Europe/Paris')::date
          >= (p_now at time zone 'Europe/Paris')::date - 2
      and e.starts_at <= p_now + interval '2 days'
  ),
  main_league as (
    -- The league with the most members among those the player added a final of the evening to,
    -- the oldest on a tie, with the last of those finals.
    select distinct on (r.user_id, r.evening) r.user_id, r.evening, l.id, l.name, ls.slug
    from recap r
    join league_scores ls on ls.user_id = r.user_id and ls.evening = r.evening
    join leagues l on l.id = ls.league_id
    order by r.user_id, r.evening,
      (select count(*) from league_members x where x.league_id = l.id) desc, l.created_at, l.id,
      ls.starts_at desc, ls.slug desc
  ),
  league_ranks as (
    -- The player's place in their main league on the evening, among the members who scored there.
    select ml.user_id, ml.evening, x.rank, x.players
    from main_league ml
    cross join lateral (
      select y.user_id, (rank() over (order by y.points desc))::int as rank,
        (count(*) over ())::int as players
      from (select ls.user_id, sum(ls.points) as points from league_scores ls
            where ls.league_id = ml.id and ls.evening = ml.evening
            group by ls.user_id) y
    ) x
    where x.user_id = ml.user_id
  ),
  due as (
    select f.user_id, 'forgotten'::text as kind, f.evening, f.payload from forgotten f
    union all
    select r.user_id, 'recap', r.evening,
      jsonb_build_object('points', r.points, 'finals', r.finals, 'competition_slug', c.slug,
                         'competition_name', c.name, 'rank', rk.rank, 'players', rk.players,
                         'league_id', ml.id, 'league_name', ml.name, 'league_event_slug', ml.slug,
                         'league_rank', lr.rank, 'league_players', lr.players)
    from recap r
    join competitions c on c.id = r.competition_id
    left join main_league ml on ml.user_id = r.user_id and ml.evening = r.evening
    left join league_ranks lr on lr.user_id = r.user_id and lr.evening = r.evening
    left join lateral (
      select x.rank, x.players
      from (
        select se.user_id, (rank() over (order by sum(se.points) desc))::int as rank,
          (count(*) over ())::int as players
        from score_events se
        join profiles p on p.id = se.user_id
        where se.competition_id = r.competition_id and p.blocked_at is null
        group by se.user_id
      ) x
      where x.user_id = r.user_id
    ) rk on true
  )
  select d.user_id, d.kind, d.evening::text, d.payload,
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from push_subscriptions s where s.user_id = d.user_id)
  from due d
  order by d.user_id, d.kind, d.evening
$$;

revoke execute on function private.prediction_reminder_due(timestamptz) from public, anon, authenticated;
