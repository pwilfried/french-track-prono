-- #1093: the « Chambrage » family of « Mes rappels » (on by default), and the reveal of a mercato
-- round. Both are read by the « Push notifications » Edge Function from private.reminder_due(),
-- as the others; the texts are in supabase/functions/_shared/push.mjs.
--
-- Chambrage (reminder_settings.trash_talk): after the points of an evening (Paris date), in a
-- league where the player has at least one opponent, at most one per player and evening, the
-- strongest first:
--   1. overtaken: a member behind them before the evening is now ahead;
--   2. overtook: they passed a member who was ahead of them;
--   3. last: they end the evening strictly last of the league with 0 pt on the finals they added
--      to it, while every other member scored;
--   4. lone_miss: in a final of the evening, every other member who added it (two at least) found
--      its winner, not them;
--   5. lone_find: they are the only one to find the winner (two others at least missed it).
-- An evening of a league is over once every event of its competitions that evening is finished
-- and its points computed, the last ones less than 24 hours ago. The league points are counted as
-- in its ranking (admin_league_members): the predictions added to the league, jokers included, on
-- events locked after the member joined; blocked players are left out. The chambrage only names
-- members of the same league. It speaks of the league, never of the general ranking, so it never
-- repeats « Résultats du soir » (points of the evening, place in the competition).
--
-- mercato_reveal (family « Manager »): once the bids of a round are revealed, at its end or when
-- everyone finished it earlier (#1084), to every participant who has not seen the reveal yet: how
-- many of the athletes they bid on they got, who took the dearest one they missed and for how much
-- more, or that the mercato is over. Once per player and round (reminder_log.ref = league:round);
-- it replaces the « Enchère soufflée » chambrage: one notification per reveal.
--
-- Same quiet hours as every family (private.is_quiet), nothing for a blocked player or one
-- without a device, never sent twice (reminder_log).

alter table reminder_settings add column trash_talk boolean not null default true;

alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('forgotten', 'recap', 'mercato_round', 'lineup', 'duel_over',
                  'moment_reaction', 'trash_talk', 'mercato_reveal'));

-- As in #681, with the « Chambrage » switch.
drop function save_reminder_settings(boolean, boolean, boolean, boolean, boolean, int, int, int);
create function save_reminder_settings(
  p_forgotten boolean, p_evening_results boolean, p_manager boolean, p_league boolean,
  p_frenchtrack boolean, p_lead_minutes int, p_quiet_from int, p_quiet_to int,
  p_trash_talk boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into reminder_settings (user_id, forgotten, evening_results, manager, league, frenchtrack,
                                 trash_talk, lead_minutes, quiet_from, quiet_to)
  values (auth.uid(), p_forgotten, p_evening_results, p_manager, p_league, p_frenchtrack,
          p_trash_talk, p_lead_minutes, p_quiet_from, p_quiet_to)
  on conflict (user_id) do update set
    forgotten = excluded.forgotten, evening_results = excluded.evening_results,
    manager = excluded.manager, league = excluded.league, frenchtrack = excluded.frenchtrack,
    trash_talk = excluded.trash_talk, lead_minutes = excluded.lead_minutes,
    quiet_from = excluded.quiet_from, quiet_to = excluded.quiet_to, updated_at = now();
end $$;
revoke execute on function save_reminder_settings(boolean, boolean, boolean, boolean, boolean, int, int, int, boolean)
  from public, anon;
grant execute on function save_reminder_settings(boolean, boolean, boolean, boolean, boolean, int, int, int, boolean)
  to authenticated;

-- The chambrage due at p_now, one row per player and evening at most.
create function private.trash_talk_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening date, ref text, payload jsonb)
language sql stable security definer set search_path = public as $$
  with players as (
    -- Not blocked, with a device, the family on, outside their quiet hours.
    select p.id as user_id
    from profiles p
    left join reminder_settings r on r.user_id = p.id
    where p.blocked_at is null
      and coalesce(r.trash_talk, true)
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not private.is_quiet(p_now, coalesce(r.quiet_from, 23), coalesce(r.quiet_to, 8))
  ),
  league_evenings as (
    -- The evenings of the last days whose events, in the competitions of a league, are all
    -- finished, the last points computed less than 24 hours ago.
    select lc.league_id, (e.starts_at at time zone 'Europe/Paris')::date as evening
    from league_competitions lc
    join events e on e.competition_id = lc.competition_id
    left join lateral (select max(se.created_at) as scored_at from score_events se
                       where se.event_id = e.id and se.source = 'prediction') s on true
    where (e.starts_at at time zone 'Europe/Paris')::date
          between (p_now at time zone 'Europe/Paris')::date - 2
              and (p_now at time zone 'Europe/Paris')::date
    group by 1, 2
    having bool_and(e.status = 'finished')
       and max(s.scored_at) > p_now - interval '24 hours'
       and max(s.scored_at) <= p_now
  ),
  counted as (
    -- What counts in the league for each member: the predictions they added to it, with their
    -- points (joker included) and the evening of their event.
    select lp.league_id, lp.user_id, (e.starts_at at time zone 'Europe/Paris')::date as evening,
      coalesce((s.detail -> 'jokers' ->> jp.kind)::int, s.points) as points
    from league_predictions lp
    join league_members m on m.league_id = lp.league_id and m.user_id = lp.user_id
    join events e on e.id = lp.event_id and e.lock_at >= m.joined_at
    join league_competitions lc on lc.league_id = lp.league_id
                               and lc.competition_id = e.competition_id
    join score_events s on s.user_id = lp.user_id and s.event_id = lp.event_id
                       and s.source = 'prediction'
    left join league_joker_plays jp on jp.league_id = lp.league_id and jp.user_id = lp.user_id
                                   and jp.event_id = lp.event_id
  ),
  standings as (
    -- Each member's points before and after the evening, and whether they played it.
    select le.league_id, le.evening, m.user_id,
      coalesce(sum(c.points) filter (where c.evening < le.evening), 0) as before,
      coalesce(sum(c.points) filter (where c.evening <= le.evening), 0) as after,
      count(c.points) filter (where c.evening = le.evening) > 0 as played
    from league_evenings le
    join league_members m on m.league_id = le.league_id
    join profiles p on p.id = m.user_id and p.blocked_at is null
    left join counted c on c.league_id = m.league_id and c.user_id = m.user_id
    group by le.league_id, le.evening, m.user_id
  ),
  ranked as (
    select s.*, s.after - s.before as tonight,
      (rank() over (partition by s.league_id, s.evening order by s.after desc))::int as rank,
      (count(*) over (partition by s.league_id, s.evening))::int as players
    from standings s
  ),
  passes as (
    -- 1: someone behind me is now ahead; 2: I passed someone ahead of me. The best placed now.
    select distinct on (me.league_id, me.evening, me.user_id, x.kind)
      me.league_id, me.evening, me.user_id, x.kind, x.priority, o.user_id as other_id,
      null::uuid as event_id, me.rank, me.players
    from ranked me
    join ranked o on o.league_id = me.league_id and o.evening = me.evening
                 and o.user_id <> me.user_id
    cross join lateral (
      select 'overtaken'::text as kind, 1 as priority
      where o.before < me.before and o.after > me.after
      union all
      select 'overtook', 2 where me.before < o.before and me.after > o.after
    ) x
    order by me.league_id, me.evening, me.user_id, x.kind, o.after desc, o.user_id
  ),
  bottom as (
    -- 3: strictly last with 0 pt on the finals I added, while every other member scored.
    select me.league_id, me.evening, me.user_id, 'last'::text as kind, 3 as priority,
      null::uuid as other_id, null::uuid as event_id, me.rank, me.players
    from ranked me
    where me.players >= 2 and me.played and me.tonight = 0
      and not exists (select 1 from ranked o
                      where o.league_id = me.league_id and o.evening = me.evening
                        and o.user_id <> me.user_id
                        and (o.tonight <= 0 or o.after <= me.after))
  ),
  winners as (
    -- Who found the winner of each final of the evening, among the members who added it.
    select le.league_id, le.evening, e.id as event_id, lp.user_id,
      exists (select 1 from results r
              where r.event_id = e.id and r.rank = 1 and r.athlete_id = pr.p1) as found
    from league_evenings le
    join league_competitions lc on lc.league_id = le.league_id
    join events e on e.competition_id = lc.competition_id and e.round = 'final'
                 and (e.starts_at at time zone 'Europe/Paris')::date = le.evening
    join league_predictions lp on lp.league_id = le.league_id and lp.event_id = e.id
    join predictions pr on pr.user_id = lp.user_id and pr.event_id = e.id
    join profiles p on p.id = lp.user_id and p.blocked_at is null
  ),
  tallies as (
    select w.*,
      (count(*) over (partition by w.league_id, w.event_id))::int as voters,
      (count(*) filter (where w.found) over (partition by w.league_id, w.event_id))::int as finders
    from winners w
  ),
  lone as (
    -- 4: the only one to miss it; 5: the only one to find it; two others at least.
    select t.league_id, t.evening, t.user_id,
      case when t.found then 'lone_find' else 'lone_miss' end as kind,
      case when t.found then 5 else 4 end as priority,
      null::uuid as other_id, t.event_id, r.rank, r.players
    from tallies t
    join ranked r on r.league_id = t.league_id and r.evening = t.evening and r.user_id = t.user_id
    where t.voters >= 3
      and ((not t.found and t.finders = t.voters - 1) or (t.found and t.finders = 1))
  ),
  chosen as (
    -- The strongest one of the evening, over all my leagues.
    select distinct on (c.user_id, c.evening) c.*
    from (select * from passes union all select * from bottom union all select * from lone) c
    join players pl on pl.user_id = c.user_id
    where c.players >= 2
    order by c.user_id, c.evening, c.priority, c.league_id, c.event_id
  )
  select c.user_id, 'trash_talk'::text, c.evening, ''::text,
    jsonb_strip_nulls(jsonb_build_object(
      'trigger', c.kind, 'league_id', c.league_id, 'league_name', l.name,
      'rank', c.rank, 'players', c.players, 'other', o.pseudo,
      'event', case when e.id is not null then jsonb_build_object(
                 'slug', e.slug, 'discipline', e.discipline, 'gender', e.gender) end))
  from chosen c
  join leagues l on l.id = c.league_id
  left join profiles o on o.id = c.other_id
  left join events e on e.id = c.event_id
  where not exists (select 1 from reminder_log g
                    where g.user_id = c.user_id and g.kind = 'trash_talk' and g.evening = c.evening)
$$;
revoke execute on function private.trash_talk_due(timestamptz) from public, anon, authenticated;

-- The reveals of mercato rounds due at p_now, one row per participant and round.
create function private.mercato_reveal_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening date, ref text, payload jsonb)
language sql stable security definer set search_path = public as $$
  with players as (
    -- Not blocked, with a device, the « Manager » family on, outside their quiet hours.
    select p.id as user_id
    from profiles p
    left join reminder_settings r on r.user_id = p.id
    where p.blocked_at is null
      and coalesce(r.manager, true)
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not private.is_quiet(p_now, coalesce(r.quiet_from, 23), coalesce(r.quiet_to, 8))
  ),
  rounds as (
    -- The rounds closed less than 24 hours ago; the last one once the mercato is over.
    select r.league_id, l.name as league_name, r.round, r.closed_at,
      l.mercato_closed_at is not null
        and not exists (select 1 from manager_rounds n
                        where n.league_id = r.league_id and n.round > r.round) as last
    from manager_rounds r
    join manager_leagues l on l.id = r.league_id
    where r.closed_at > p_now - interval '24 hours' and r.closed_at <= p_now
  )
  select m.user_id, 'mercato_reveal'::text, (rd.closed_at at time zone 'Europe/Paris')::date,
    rd.league_id || ':' || rd.round,
    jsonb_build_object(
      'league_id', rd.league_id, 'league_name', rd.league_name, 'round', rd.round,
      'last', rd.last,
      'bids', (select count(*) from manager_round_bids b
               where b.league_id = rd.league_id and b.round = rd.round and b.user_id = m.user_id),
      'won', (select count(*) from manager_round_bids b
              where b.league_id = rd.league_id and b.round = rd.round and b.user_id = m.user_id
                and b.won),
      -- The dearest athlete I missed, who took them and for how much more.
      'lost', (select jsonb_build_object('pseudo', o.pseudo, 'athlete', a.name,
                                         'diff', w.amount - b.amount)
               from manager_round_bids b
               join manager_awards w on w.league_id = b.league_id and w.athlete_id = b.athlete_id
                                    and w.round = b.round and w.user_id <> b.user_id
               join profiles o on o.id = w.user_id
               join athletes a on a.id = b.athlete_id
               where b.league_id = rd.league_id and b.round = rd.round and b.user_id = m.user_id
                 and not b.won
               order by b.amount desc, a.name
               limit 1))
  from rounds rd
  join manager_members m on m.league_id = rd.league_id
  join players pl on pl.user_id = m.user_id
  where m.revealed_round < rd.round
    and not exists (select 1 from reminder_log g
                    where g.user_id = m.user_id and g.kind = 'mercato_reveal'
                      and g.ref = rd.league_id || ':' || rd.round)
$$;
revoke execute on function private.mercato_reveal_due(timestamptz) from public, anon, authenticated;

-- Every reminder due at p_now, with the player's devices: those of #681 (ref empty), the Manager
-- ones (#836), the reactions to their moments (#672), then the mercato reveals and the chambrage.
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
        select * from private.trash_talk_due(p_now)) m
  order by 1, 2, 3, 4
$$;
revoke execute on function private.reminder_due(timestamptz) from public, anon, authenticated;
