-- #203: push notifications. A player turns them on from their profile, per device. The « Push
-- notifications » workflow (every 5 minutes, as the database owner) reads what is due and sends it:
-- a reminder before the lock of a final they have not predicted yet, in a competition they play,
-- and their points once computed. One notification an hour at most per player.

-- One row per device (browser subscription). Written through the functions below only.
create table push_subscriptions (
  endpoint   text primary key check (endpoint like 'https://%' and length(endpoint) <= 1000),
  user_id    uuid not null references profiles(id) on delete cascade,
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
create policy "a player reads their own devices" on push_subscriptions
  for select using (user_id = auth.uid());
revoke insert, update, delete on push_subscriptions from anon, authenticated;

-- What was sent: never twice the same notification, and at most one an hour.
create table push_log (
  user_id  uuid not null references profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  kind     text not null check (kind in ('reminder', 'result')),
  sent_at  timestamptz not null default now(),
  primary key (user_id, event_id, kind)
);
create index on push_log (user_id, sent_at);
alter table push_log enable row level security;
revoke all on push_log from anon, authenticated;

-- The signed-in player turns notifications on for this device (a shared device moves to them).
create function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

-- The signed-in player turns them off for this device.
create function delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

revoke execute on function save_push_subscription(text, text, text) from public, anon;
revoke execute on function delete_push_subscription(text) from public, anon;
grant execute on function save_push_subscription(text, text, text) to authenticated;
grant execute on function delete_push_subscription(text) to authenticated;

-- The notification due for each player, one at most (reminders first), with their devices.
create function private.push_due()
returns table (user_id uuid, kind text, event_slug text, discipline text, gender char(1),
               lock_at timestamptz, points int, devices jsonb)
language sql stable security definer set search_path = public as $$
  with players as (select distinct s.user_id from push_subscriptions s),
  due as (
    -- A final locking in the next 20 minutes, not predicted, in a competition the player plays.
    select pl.user_id, 'reminder'::text as kind, e.id as event_id, e.lock_at as at, null::int as points
    from players pl
    join events e on e.lock_at > now() and e.lock_at <= now() + interval '20 minutes'
    where is_predictable(e.id)
      and exists (select 1 from predictions p
                  where p.user_id = pl.user_id and p.competition_id = e.competition_id)
      and not exists (select 1 from predictions p where p.user_id = pl.user_id and p.event_id = e.id)
    union all
    -- Points computed in the last 24 hours (nothing older is sent).
    select se.user_id, 'result', se.event_id, se.created_at, se.points
    from score_events se join players pl on pl.user_id = se.user_id
    where se.source = 'prediction' and se.created_at > now() - interval '24 hours'
  )
  select distinct on (d.user_id)
    d.user_id, d.kind, e.slug, e.discipline, e.gender, e.lock_at, d.points,
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from push_subscriptions s where s.user_id = d.user_id)
  from due d
  join events e on e.id = d.event_id
  join profiles p on p.id = d.user_id
  where p.blocked_at is null
    and not exists (select 1 from push_log l
                    where l.user_id = d.user_id and l.event_id = d.event_id and l.kind = d.kind)
    and not exists (select 1 from push_log l
                    where l.user_id = d.user_id and l.sent_at > now() - interval '1 hour')
  order by d.user_id, d.kind = 'reminder' desc, d.at
$$;

-- Records what was sent: [{"user_id", "event_slug", "kind"}]. Forgets entries older than 30 days.
create function private.push_mark_sent(p_sent jsonb) returns void
language sql security definer set search_path = public as $$
  insert into push_log (user_id, event_id, kind)
  select s.user_id, e.id, s.kind
  from jsonb_to_recordset(p_sent) as s(user_id uuid, event_slug text, kind text)
  join events e on e.slug = s.event_slug
  on conflict do nothing;
  delete from push_log where sent_at < now() - interval '30 days';
$$;

-- Devices the push service no longer knows (unsubscribed, app removed).
create function private.push_forget(p_endpoints text[]) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = any(p_endpoints)
$$;

revoke execute on function private.push_due() from public, anon, authenticated;
revoke execute on function private.push_mark_sent(jsonb) from public, anon, authenticated;
revoke execute on function private.push_forget(text[]) from public, anon, authenticated;
