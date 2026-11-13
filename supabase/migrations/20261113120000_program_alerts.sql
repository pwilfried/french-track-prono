-- #659: « Me prévenir à la publication ». On a competition whose programme is not published yet,
-- a signed-in player asks to be told. When the competition gets its first event, the « Push
-- notifications » Edge Function (pg_cron, every minute: 20261111180000_push_cron.sql) sends each
-- of them one notification, through private.program_due() and private.program_mark_sent().

-- One row per player and competition. Written through the functions below only.
create table program_alerts (
  user_id        uuid not null references profiles(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  created_at     timestamptz not null default now(),
  notified_at    timestamptz,
  primary key (user_id, competition_id)
);
create index on program_alerts (competition_id) where notified_at is null;
alter table program_alerts enable row level security;
create policy "a player reads their own alerts" on program_alerts
  for select using (user_id = auth.uid());
revoke insert, update, delete on program_alerts from anon, authenticated;

-- The signed-in player asks to be told when the programme of the competition (slug) is out.
create function turn_on_program_alert(p_competition text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into program_alerts (user_id, competition_id)
  select auth.uid(), c.id from competitions c where c.slug = p_competition
  on conflict do nothing;
end $$;

-- The signed-in player changes their mind.
create function turn_off_program_alert(p_competition text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  delete from program_alerts a
  using competitions c
  where c.id = a.competition_id and c.slug = p_competition and a.user_id = auth.uid();
end $$;

revoke execute on function turn_on_program_alert(text) from public, anon;
revoke execute on function turn_off_program_alert(text) from public, anon;
grant execute on function turn_on_program_alert(text) to authenticated;
grant execute on function turn_off_program_alert(text) to authenticated;

-- The alerts due: not sent yet, the competition has at least one event, the player is not
-- blocked and has at least one device. One row per player and competition, with their devices.
create function private.program_due()
returns table (user_id uuid, competition_slug text, competition_name text, devices jsonb)
language sql stable security definer set search_path = public as $$
  select a.user_id, c.slug, c.name,
    (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
     from push_subscriptions s where s.user_id = a.user_id)
  from program_alerts a
  join competitions c on c.id = a.competition_id
  join profiles p on p.id = a.user_id
  where a.notified_at is null
    and p.blocked_at is null
    and exists (select 1 from events e where e.competition_id = c.id)
    and exists (select 1 from push_subscriptions s where s.user_id = a.user_id)
  order by a.user_id, c.slug
$$;

-- Records what was sent: [{"user_id", "competition_slug"}]. Never sent again.
create function private.program_mark_sent(p_sent jsonb) returns void
language sql security definer set search_path = public as $$
  update program_alerts a set notified_at = now()
  from jsonb_to_recordset(p_sent) as s(user_id uuid, competition_slug text), competitions c
  where c.slug = s.competition_slug and a.competition_id = c.id and a.user_id = s.user_id
    and a.notified_at is null
$$;

revoke execute on function private.program_due() from public, anon, authenticated;
revoke execute on function private.program_mark_sent(jsonb) from public, anon, authenticated;
