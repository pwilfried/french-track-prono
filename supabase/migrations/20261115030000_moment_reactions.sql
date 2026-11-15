-- v0.19 (#672): the members of a league react to its moments (#671), with no free text
-- (non-goal 6): an emoji from a fixed list (one of each per player, removable), and a preset
-- message (one per player and moment, a second one replaces the first). Both are stored as codes;
-- src/app/messages.fr.ts writes the emojis and the sentences. Same lists as
-- src/domain/moment-reactions.ts.
-- Moderation (decision of the owner, 14 Nov 2026): a member reports a reaction or a message once;
-- the admin hides it (gone for everyone) or dismisses its reports. Players hide nothing.
-- The player a moment is about gets a light push notification when someone reacts to it, grouped,
-- at most one an hour (family « Ligues » of « Mes rappels », same quiet hours).
-- Error codes: 42501 not signed in / not a member / not an admin, P0002 unknown moment or
-- reaction, 23514 a code out of the lists.

create table moment_reactions (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null,
  moment_key text not null,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null check (kind in ('emoji', 'message')),
  code       text not null,
  hidden_at  timestamptz,
  created_at timestamptz not null default now(),
  foreign key (league_id, moment_key) references league_moments (league_id, key) on delete cascade,
  check ((kind = 'emoji' and code in ('fire', 'clap', 'wow', 'laugh'))
      or (kind = 'message'
          and code in ('well_played', 'what_flair', 'rematch', 'bad_luck', 'catching_up')))
);
-- One emoji of each sort, and one message, per player and moment (a hidden one is kept apart).
create unique index moment_reactions_one_emoji on moment_reactions (league_id, moment_key, user_id, code)
  where kind = 'emoji' and hidden_at is null;
create unique index moment_reactions_one_message on moment_reactions (league_id, moment_key, user_id)
  where kind = 'message' and hidden_at is null;
create index on moment_reactions (league_id, created_at);

-- A member reads what is not hidden in their leagues; a blocked player's reactions disappear as
-- their moments do. Writes go through the functions below.
alter table moment_reactions enable row level security;
create policy members_read on moment_reactions for select to authenticated
  using (hidden_at is null and is_league_member(league_id)
         and (user_id = auth.uid() or not is_blocked(user_id)));
revoke insert, update, delete, truncate on moment_reactions from anon, authenticated;

-- One report per player and reaction; dismissed by the admin, it stays (no second report).
create table moment_reaction_reports (
  reaction_id  uuid not null references moment_reactions(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  dismissed_at timestamptz,
  primary key (reaction_id, user_id)
);
alter table moment_reaction_reports enable row level security;
create policy own_reports on moment_reaction_reports for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete, truncate on moment_reaction_reports from anon, authenticated;

-- The moment exists, and the signed-in player is a member of its league.
create function private.check_moment_member(p_league uuid, p_key text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_league_member(p_league) then
    raise exception 'only a member reacts' using errcode = '42501';
  end if;
  if not exists (select 1 from league_moments where league_id = p_league and key = p_key) then
    raise exception 'unknown moment' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function private.check_moment_member(uuid, text) from public, anon;
grant execute on function private.check_moment_member(uuid, text) to authenticated;

-- Adds my emoji to a moment; the same one again changes nothing.
create function add_moment_reaction(p_league uuid, p_key text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_moment_member(p_league, p_key);
  insert into moment_reactions (league_id, moment_key, user_id, kind, code)
  values (p_league, p_key, auth.uid(), 'emoji', p_code)
  on conflict (league_id, moment_key, user_id, code) where kind = 'emoji' and hidden_at is null
  do nothing;
end $$;

-- Removes my emoji from a moment, if I gave it (a hidden one stays hidden).
create function remove_moment_reaction(p_league uuid, p_key text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_moment_member(p_league, p_key);
  delete from moment_reactions
  where league_id = p_league and moment_key = p_key and user_id = auth.uid()
    and kind = 'emoji' and code = p_code and hidden_at is null;
end $$;

-- Sends my preset message under a moment: it replaces the one I sent before.
create function send_moment_message(p_league uuid, p_key text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.check_moment_member(p_league, p_key);
  -- A new row, not the old one changed: a report stays with what was reported.
  delete from moment_reactions
  where league_id = p_league and moment_key = p_key and user_id = auth.uid()
    and kind = 'message' and hidden_at is null;
  insert into moment_reactions (league_id, moment_key, user_id, kind, code)
  values (p_league, p_key, auth.uid(), 'message', p_code);
end $$;

-- Reports a reaction or a message of my leagues; reporting twice changes nothing.
create function report_moment_reaction(p_reaction uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from moment_reactions
                 where id = p_reaction and hidden_at is null and is_league_member(league_id)) then
    raise exception 'unknown reaction' using errcode = 'P0002';
  end if;
  insert into moment_reaction_reports (reaction_id, user_id) values (p_reaction, auth.uid())
  on conflict do nothing;
end $$;

revoke execute on function add_moment_reaction(uuid, text, text) from public, anon;
revoke execute on function remove_moment_reaction(uuid, text, text) from public, anon;
revoke execute on function send_moment_message(uuid, text, text) from public, anon;
revoke execute on function report_moment_reaction(uuid) from public, anon;
grant execute on function add_moment_reaction(uuid, text, text) to authenticated;
grant execute on function remove_moment_reaction(uuid, text, text) to authenticated;
grant execute on function send_moment_message(uuid, text, text) to authenticated;
grant execute on function report_moment_reaction(uuid) to authenticated;

-- The reactions and messages of a league's feed, oldest first, with the pseudo and bib of who
-- sent them, and whether I sent or reported them. Security invoker: row level security hides
-- what is hidden, and everything from someone outside the league.
create function league_feed_reactions(p_league uuid)
returns table (id uuid, moment_key text, kind text, code text, pseudo text, bib_number int,
               bib_color text, mine boolean, reported boolean)
language sql stable set search_path = public as $$
  select r.id, r.moment_key, r.kind, r.code, p.pseudo, p.bib_number::int, p.bib_color,
         r.user_id = auth.uid(),
         exists (select 1 from moment_reaction_reports rr
                 where rr.reaction_id = r.id and rr.user_id = auth.uid())
  from moment_reactions r
  join profiles p on p.id = r.user_id
  where r.league_id = p_league
  order by r.created_at, r.id
$$;
revoke execute on function league_feed_reactions(uuid) from public, anon;
grant execute on function league_feed_reactions(uuid) to authenticated;

-- The reported reactions and messages still shown, the most reported first (admin only).
create function admin_list_moment_reports()
returns table (reaction_id uuid, kind text, code text, pseudo text, league_id uuid,
               league_name text, moment_kind text, report_count bigint,
               last_reported_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin sees the reports' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind, r.code, p.pseudo, l.id, l.name, m.kind, count(*), max(rr.created_at)
    from moment_reactions r
    join moment_reaction_reports rr on rr.reaction_id = r.id and rr.dismissed_at is null
    join profiles p on p.id = r.user_id
    join leagues l on l.id = r.league_id
    join league_moments m on m.league_id = r.league_id and m.key = r.moment_key
    where r.hidden_at is null
    group by r.id, r.kind, r.code, p.pseudo, l.id, l.name, m.kind
    order by count(*) desc, max(rr.created_at) desc;
end $$;

-- The admin hides a reaction or a message: it disappears for everyone (logged).
create function admin_hide_moment_reaction(p_reaction uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  if not is_admin() then
    raise exception 'only an admin hides a reaction' using errcode = '42501';
  end if;
  update moment_reactions set hidden_at = now()
  where id = p_reaction and hidden_at is null
  returning league_id into v_league;
  if v_league is null then
    raise exception 'unknown reaction' using errcode = 'P0002';
  end if;
  update moment_reaction_reports set dismissed_at = now()
  where reaction_id = p_reaction and dismissed_at is null;
  perform private.log_admin_action('moderate_league', null,
    jsonb_build_object('league', v_league, 'hidden_reaction', p_reaction));
end $$;

-- The reports were unfounded: the admin dismisses them, the reaction stays.
create function admin_dismiss_moment_reports(p_reaction uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin dismisses reports' using errcode = '42501';
  end if;
  if not exists (select 1 from moment_reactions where id = p_reaction) then
    raise exception 'unknown reaction' using errcode = 'P0002';
  end if;
  update moment_reaction_reports set dismissed_at = now()
  where reaction_id = p_reaction and dismissed_at is null;
end $$;

revoke execute on function admin_list_moment_reports() from public, anon;
revoke execute on function admin_hide_moment_reaction(uuid) from public, anon;
revoke execute on function admin_dismiss_moment_reports(uuid) from public, anon;
grant execute on function admin_list_moment_reports() to authenticated;
grant execute on function admin_hide_moment_reaction(uuid) to authenticated;
grant execute on function admin_dismiss_moment_reports(uuid) to authenticated;

-- The push notification: « Untel a réagi à ton moment », grouped. Sent to the player a moment is
-- about, for what others added since the last one, at most one an hour.
alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('forgotten', 'recap', 'mercato_round', 'lineup', 'duel_over',
                  'moment_reaction'));

create function private.moment_reaction_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening date, ref text, payload jsonb)
language sql stable security definer set search_path = public as $$
  with players as (
    -- Not blocked, with a device, the « Ligues » family on, outside their quiet hours, nothing
    -- of this kind sent in the last hour.
    select p.id as user_id,
      (select max(l.sent_at) from reminder_log l
       where l.user_id = p.id and l.kind = 'moment_reaction') as last_sent
    from profiles p
    left join reminder_settings r on r.user_id = p.id
    where p.blocked_at is null
      and coalesce(r.league, true)
      and exists (select 1 from push_subscriptions s where s.user_id = p.id)
      and not private.is_quiet(p_now, coalesce(r.quiet_from, 23), coalesce(r.quiet_to, 8))
      and not exists (select 1 from reminder_log l
                      where l.user_id = p.id and l.kind = 'moment_reaction'
                        and l.sent_at > p_now - interval '1 hour')
  ),
  fresh as (
    -- What others added to my moments since the last notification, in the last 24 hours.
    select pl.user_id, r.created_at, r.league_id, o.pseudo
    from players pl
    join league_moments m on m.user_id = pl.user_id
    join moment_reactions r on r.league_id = m.league_id and r.moment_key = m.key
    join profiles o on o.id = r.user_id
    where r.user_id <> pl.user_id
      and r.hidden_at is null
      and o.blocked_at is null
      and r.created_at > greatest(coalesce(pl.last_sent, '-infinity'), p_now - interval '24 hours')
      and r.created_at <= p_now
  ),
  grouped as (
    select f.user_id, count(*)::int as count, max(f.created_at) as last_at,
      (array_agg(f.pseudo order by f.created_at desc))[1] as pseudo,
      (array_agg(f.league_id order by f.created_at desc))[1] as league_id
    from fresh f
    group by f.user_id
  )
  select g.user_id, 'moment_reaction'::text, (p_now at time zone 'Europe/Paris')::date,
    to_char(g.last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    jsonb_build_object('count', g.count, 'pseudo', g.pseudo, 'league_id', g.league_id,
                       'league_name', l.name)
  from grouped g
  join leagues l on l.id = g.league_id
$$;
revoke execute on function private.moment_reaction_due(timestamptz) from public, anon, authenticated;

-- Every reminder due at p_now, with the player's devices: those of #681 (ref empty), the Manager
-- ones (#836), then the reactions to their moments.
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
        select * from private.moment_reaction_due(p_now)) m
  order by 1, 2, 3, 4
$$;
revoke execute on function private.reminder_due(timestamptz) from public, anon, authenticated;
