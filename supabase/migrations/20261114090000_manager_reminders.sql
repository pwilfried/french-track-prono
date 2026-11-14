-- #836: the « Manager » family of « Mes rappels » (#681) now sends its reminders, read by the
-- « Push notifications » Edge Function from private.reminder_due() as the others:
--   - mercato_round: the open round of a mercato ends within 2 h, to every participant who can
--     still recruit (private.manager_recruiters);
--   - lineup: the lineups of a matchday lock within the player's lead (« délai avant verrou »)
--     and theirs is not validated;
--   - duel_over: every event of a head-to-head's competition is finished and its Manager scores
--     computed (less than 24 hours ago), to both players.
-- Same switch (reminder_settings.manager), same quiet hours; each one is sent once per player and
-- league round or competition (reminder_log.ref), whatever the evening.
-- Same rules as src/domain/manager-reminders.ts.

-- What a reminder is about, for the Manager ones (league:round or league:competition); empty for
-- the others, sent once per evening.
alter table reminder_log add column ref text not null default '';
alter table reminder_log drop constraint reminder_log_pkey;
alter table reminder_log add primary key (user_id, kind, evening, ref);
alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('forgotten', 'recap', 'mercato_round', 'lineup', 'duel_over'));

-- The prediction reminders of #681, unchanged, under another name.
alter function private.reminder_due(timestamptz) rename to prediction_reminder_due;

-- The Manager reminders due at p_now, one row per player and league round or competition.
create function private.manager_reminder_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening date, ref text, payload jsonb)
language sql stable security definer set search_path = public as $$
  with players as (
    -- Not blocked, with a device, the family on, outside their quiet hours.
    select p.id as user_id, coalesce(r.lead_minutes, 60) as lead_minutes
    from profiles p
    left join reminder_settings r on r.user_id = p.id
    where p.blocked_at is null
      and coalesce(r.manager, true)
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not private.is_quiet(p_now, coalesce(r.quiet_from, 23), coalesce(r.quiet_to, 8))
  ),
  rounds as (
    -- Open rounds ending within 2 hours.
    select l.id as league_id, l.name as league_name, o.round, o.ends_at
    from manager_leagues l
    cross join lateral private.manager_open_round(l.id) o
    where l.mercato_opened_at is not null and l.mercato_closed_at is null
      and o.ends_at > p_now and o.ends_at <= p_now + interval '2 hours'
  ),
  mercato_round as (
    select pl.user_id, 'mercato_round'::text as kind,
      (r.ends_at at time zone 'Europe/Paris')::date as evening,
      r.league_id || ':' || r.round as ref,
      jsonb_build_object('league_id', r.league_id, 'league_name', r.league_name,
                         'round', r.round, 'ends_at', r.ends_at) as payload
    from rounds r
    join manager_members m on m.league_id = r.league_id
    join players pl on pl.user_id = m.user_id
    where m.user_id in (select private.manager_recruiters(r.league_id))
  ),
  locks as (
    -- The matchdays of a season under way whose lineups lock within the longest lead (3 h).
    select x.* from (
      select md.league_id, l.name as league_name, c.id as competition_id, c.slug, c.name,
        private.manager_lineup_lock(c.id) as lock_at
      from manager_matchdays md
      join manager_leagues l on l.id = md.league_id
      join competitions c on c.id = md.competition_id
      where l.mercato_closed_at is not null
    ) x
    where x.lock_at > p_now and x.lock_at <= p_now + interval '3 hours'
  ),
  lineup as (
    select pl.user_id, 'lineup'::text as kind,
      (k.lock_at at time zone 'Europe/Paris')::date as evening,
      k.league_id || ':' || k.competition_id as ref,
      jsonb_build_object('league_id', k.league_id, 'league_name', k.league_name,
                         'competition_slug', k.slug, 'competition_name', k.name,
                         'lock_at', k.lock_at) as payload
    from locks k
    join manager_members m on m.league_id = k.league_id
    join players pl on pl.user_id = m.user_id
    where k.lock_at <= p_now + make_interval(mins => pl.lead_minutes)
      and not exists (select 1 from manager_lineups ml
                      where ml.league_id = k.league_id and ml.competition_id = k.competition_id
                        and ml.user_id = m.user_id)
  ),
  duels as (
    -- Head-to-heads whose competition is over and scored less than 24 hours ago.
    select f.league_id, l.name as league_name, f.round, f.home_id, f.away_id,
      coalesce(h.total, 0) as home_score, coalesce(a.total, 0) as away_score, s.scored_at
    from manager_fixtures f
    join manager_leagues l on l.id = f.league_id
    join manager_matchdays md on md.league_id = f.league_id and md.round = f.round
    cross join lateral (select max(ms.computed_at) as scored_at from manager_scores ms
                        where ms.league_id = f.league_id
                          and ms.competition_id = md.competition_id) s
    left join manager_scores h
      on h.league_id = f.league_id and h.competition_id = md.competition_id and h.user_id = f.home_id
    left join manager_scores a
      on a.league_id = f.league_id and a.competition_id = md.competition_id and a.user_id = f.away_id
    where not md.bonus and md.competition_id is not null
      and s.scored_at > p_now - interval '24 hours'
      and exists (select 1 from events e where e.competition_id = md.competition_id)
      and not exists (select 1 from events e
                      where e.competition_id = md.competition_id and e.status <> 'finished')
  ),
  sides as (
    select d.league_id, d.league_name, d.round, d.home_id, d.scored_at,
      d.home_id as user_id, d.away_id as opponent_id, d.home_score as my_score,
      d.away_score as their_score
    from duels d
    union all
    select d.league_id, d.league_name, d.round, d.home_id, d.scored_at,
      d.away_id, d.home_id, d.away_score, d.home_score
    from duels d
  ),
  duel_over as (
    select pl.user_id, 'duel_over'::text as kind,
      (sd.scored_at at time zone 'Europe/Paris')::date as evening,
      sd.league_id || ':' || sd.round as ref,
      jsonb_build_object('league_id', sd.league_id, 'league_name', sd.league_name,
                         'round', sd.round, 'home_id', sd.home_id,
                         'my_score', sd.my_score, 'their_score', sd.their_score,
                         'opponent', o.pseudo) as payload
    from sides sd
    join players pl on pl.user_id = sd.user_id
    join profiles o on o.id = sd.opponent_id
  ),
  due as (
    select * from mercato_round
    union all
    select * from lineup
    union all
    select * from duel_over
  )
  -- Once per player, kind and round or competition.
  select d.user_id, d.kind, d.evening, d.ref, d.payload
  from due d
  where not exists (select 1 from reminder_log l
                    where l.user_id = d.user_id and l.kind = d.kind and l.ref = d.ref)
$$;

-- Every reminder due at p_now, with the player's devices: those of #681 (ref empty), then the
-- Manager ones.
create function private.reminder_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening text, ref text, payload jsonb, devices jsonb)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.kind, p.evening, ''::text, p.payload, p.devices
  from private.prediction_reminder_due(p_now) p
  union all
  select m.user_id, m.kind, m.evening::text, m.ref, m.payload,
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from push_subscriptions s where s.user_id = m.user_id)
  from private.manager_reminder_due(p_now) m
  order by 1, 2, 3, 4
$$;

-- Records what was sent: [{"user_id", "kind", "evening", "ref"?}]. Forgets entries older than
-- 30 days.
create or replace function private.reminder_mark_sent(p_sent jsonb) returns void
language sql security definer set search_path = public as $$
  insert into reminder_log (user_id, kind, evening, ref)
  select s.user_id, s.kind, s.evening, coalesce(s.ref, '')
  from jsonb_to_recordset(p_sent) as s(user_id uuid, kind text, evening date, ref text)
  on conflict do nothing;
  delete from reminder_log where sent_at < now() - interval '30 days';
$$;

revoke execute on function private.prediction_reminder_due(timestamptz) from public, anon, authenticated;
revoke execute on function private.manager_reminder_due(timestamptz) from public, anon, authenticated;
revoke execute on function private.reminder_due(timestamptz) from public, anon, authenticated;
revoke execute on function private.reminder_mark_sent(jsonb) from public, anon, authenticated;
