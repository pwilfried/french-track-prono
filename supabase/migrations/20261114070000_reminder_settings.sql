-- #681: smart reminders. A player tunes them from « Mes rappels » (profile): a switch per family,
-- how long before a lock « Pronos oubliés » may be sent (30 min, 1 h, 3 h), and quiet hours
-- (23 h–8 h by default, Paris time). The « Push notifications » Edge Function (pg_cron, every
-- minute: 20261111180000_push_cron.sql) now sends grouped reminders, read from
-- private.reminder_due(), instead of one notification per final (private.push_due(), dropped):
--   - « Pronos oubliés »: one message for every final of the evening locking within the lead,
--     when podiums are missing; at most one per player and evening;
--   - « Résultats du soir »: one recap once every final the player predicted that evening has
--     its points (points of the evening, place in the competition).
-- Nothing is sent during the quiet hours: what is still due is sent when they end.
-- Same rules as src/domain/reminders.ts.

-- One row per player who saved their settings; no row means the defaults.
create table reminder_settings (
  user_id         uuid primary key references profiles(id) on delete cascade,
  forgotten       boolean not null default true,
  evening_results boolean not null default true,
  manager         boolean not null default true,
  league          boolean not null default true,
  frenchtrack     boolean not null default true,
  lead_minutes    int not null default 60 check (lead_minutes in (30, 60, 180)),
  quiet_from      smallint not null default 23 check (quiet_from between 0 and 23),
  quiet_to        smallint not null default 8 check (quiet_to between 0 and 23),
  updated_at      timestamptz not null default now()
);
alter table reminder_settings enable row level security;
create policy "a player reads their own reminder settings" on reminder_settings
  for select using (user_id = auth.uid());
revoke insert, update, delete on reminder_settings from anon, authenticated;

-- What was sent, per player, kind and evening (Paris date): never twice the same.
create table reminder_log (
  user_id  uuid not null references profiles(id) on delete cascade,
  kind     text not null check (kind in ('forgotten', 'recap')),
  evening  date not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, kind, evening)
);
alter table reminder_log enable row level security;
revoke all on reminder_log from anon, authenticated;

-- The signed-in player saves their settings (the form checks them first; the table again).
create function save_reminder_settings(
  p_forgotten boolean, p_evening_results boolean, p_manager boolean, p_league boolean,
  p_frenchtrack boolean, p_lead_minutes int, p_quiet_from int, p_quiet_to int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into reminder_settings (user_id, forgotten, evening_results, manager, league, frenchtrack,
                                 lead_minutes, quiet_from, quiet_to)
  values (auth.uid(), p_forgotten, p_evening_results, p_manager, p_league, p_frenchtrack,
          p_lead_minutes, p_quiet_from, p_quiet_to)
  on conflict (user_id) do update set
    forgotten = excluded.forgotten, evening_results = excluded.evening_results,
    manager = excluded.manager, league = excluded.league, frenchtrack = excluded.frenchtrack,
    lead_minutes = excluded.lead_minutes, quiet_from = excluded.quiet_from,
    quiet_to = excluded.quiet_to, updated_at = now();
end $$;

revoke execute on function save_reminder_settings(boolean, boolean, boolean, boolean, boolean, int, int, int)
  from public, anon;
grant execute on function save_reminder_settings(boolean, boolean, boolean, boolean, boolean, int, int, int)
  to authenticated;

-- Within the quiet hours (Paris time)? From p_from (included) to p_to (excluded); equal: none.
create function private.is_quiet(p_at timestamptz, p_from int, p_to int) returns boolean
language sql stable set search_path = public as $$
  select case
    when p_from = p_to then false
    when p_from < p_to then h >= p_from and h < p_to
    else h >= p_from or h < p_to
  end
  from (select extract(hour from p_at at time zone 'Europe/Paris')::int as h) clock
$$;

-- The grouped reminders due at p_now, one row per player, kind and evening (YYYY-MM-DD, Paris
-- date), with their devices.
create function private.reminder_due(p_now timestamptz default now())
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
    -- they play, on an evening not reminded yet.
    select pl.user_id, e.slug, e.discipline, e.gender, e.lock_at,
      (e.lock_at at time zone 'Europe/Paris')::date as evening
    from players pl
    join events e on e.lock_at > p_now
                 and e.lock_at <= p_now + make_interval(mins => pl.lead_minutes)
    where pl.forgotten
      and is_predictable(e.id)
      and exists (select 1 from predictions p
                  where p.user_id = pl.user_id and p.competition_id = e.competition_id)
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
  due as (
    select f.user_id, 'forgotten'::text as kind, f.evening, f.payload from forgotten f
    union all
    select r.user_id, 'recap', r.evening,
      jsonb_build_object('points', r.points, 'finals', r.finals, 'competition_slug', c.slug,
                         'competition_name', c.name, 'rank', rk.rank, 'players', rk.players)
    from recap r
    join competitions c on c.id = r.competition_id
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

-- Records what was sent: [{"user_id", "kind", "evening"}]. Forgets entries older than 30 days.
create function private.reminder_mark_sent(p_sent jsonb) returns void
language sql security definer set search_path = public as $$
  insert into reminder_log (user_id, kind, evening)
  select s.user_id, s.kind, s.evening
  from jsonb_to_recordset(p_sent) as s(user_id uuid, kind text, evening date)
  on conflict do nothing;
  delete from reminder_log where sent_at < now() - interval '30 days';
$$;

revoke execute on function private.is_quiet(timestamptz, int, int) from public, anon, authenticated;
revoke execute on function private.reminder_due(timestamptz) from public, anon, authenticated;
revoke execute on function private.reminder_mark_sent(jsonb) from public, anon, authenticated;

-- One notification per final is replaced by the grouped reminders above.
drop function private.push_due();
drop function private.push_mark_sent(jsonb);
drop table push_log;
