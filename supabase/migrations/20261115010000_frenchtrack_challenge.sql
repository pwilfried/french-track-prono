-- #674 « Battez FrenchTrack »: on the big finals, the admin (the FrenchTrack account) posts
-- FrenchTrack's podium before the lock. An event with such a podium is a challenge. The podium is
-- hidden from the players until the lock, even through the API; its points are computed by the
-- app with the scale of the players (`src/domain/frenchtrack.ts`) and stored with theirs.
-- Error codes: 42501 not signed in or not an admin, FT034 the event is locked,
-- 23503 an athlete who is not on the start list, 23514 the same athlete twice.
create table frenchtrack_picks (
  event_id   uuid primary key references events(id) on delete cascade,
  p1         uuid not null,
  p2         uuid not null,
  p3         uuid not null,
  -- Null until the points of the event are computed.
  points     int,
  updated_at timestamptz not null default now(),
  check (p1 <> p2 and p1 <> p3 and p2 <> p3),
  foreign key (event_id, p1) references entries(event_id, athlete_id) on delete cascade,
  foreign key (event_id, p2) references entries(event_id, athlete_id) on delete cascade,
  foreign key (event_id, p3) references entries(event_id, athlete_id) on delete cascade
);

-- Nobody reads or writes the table through the API: only the functions below do.
alter table frenchtrack_picks enable row level security;
revoke all on frenchtrack_picks from anon, authenticated;

create function admin_set_frenchtrack_pick(p_event uuid, p_p1 uuid, p_p2 uuid, p_p3 uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin posts the podium of FrenchTrack' using errcode = '42501';
  end if;
  if exists (select 1 from events e where e.id = p_event and e.lock_at <= now()) then
    raise exception 'event locked' using errcode = 'FT034';
  end if;
  insert into frenchtrack_picks (event_id, p1, p2, p3)
  values (p_event, p_p1, p_p2, p_p3)
  on conflict (event_id) do update
    set p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, points = null, updated_at = now();
end $$;

create function admin_remove_frenchtrack_pick(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin removes a challenge' using errcode = '42501';
  end if;
  if exists (select 1 from events e where e.id = p_event and e.lock_at <= now()) then
    raise exception 'event locked' using errcode = 'FT034';
  end if;
  delete from frenchtrack_picks where event_id = p_event;
end $$;

-- Called with the points of the players, by the admin who computes the event.
create function admin_set_frenchtrack_points(p_event uuid, p_points int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin computes points' using errcode = '42501';
  end if;
  update frenchtrack_picks set points = p_points where event_id = p_event;
end $$;

-- The challenge of an event as the caller sees it; no row when the event is no challenge. The
-- podium comes back once the event is locked (at any time for the admin); with FrenchTrack's
-- points come the caller's (null: no prediction) and those of every player, without any name.
create function frenchtrack_challenge(p_event uuid)
returns table (locked boolean, p1 uuid, p2 uuid, p3 uuid, points int, mine int, scores int[])
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return query
    select e.lock_at <= now(),
           case when e.lock_at <= now() or is_admin() then f.p1 end,
           case when e.lock_at <= now() or is_admin() then f.p2 end,
           case when e.lock_at <= now() or is_admin() then f.p3 end,
           case when e.lock_at <= now() then f.points end,
           case when e.lock_at <= now() and f.points is not null then
             (select s.points from score_events s
              where s.event_id = p_event and s.source = 'prediction' and s.user_id = auth.uid())
           end,
           case when e.lock_at <= now() and f.points is not null then
             array(select s.points from score_events s
                   where s.event_id = p_event and s.source = 'prediction'
                     and not is_blocked(s.user_id)
                   order by s.points)
           else '{}'::int[] end
    from frenchtrack_picks f
    join events e on e.id = f.event_id
    where f.event_id = p_event;
end $$;

-- The challenges of a season (a calendar year, Paris time), for the home card: FrenchTrack's
-- points and the caller's once computed.
create function frenchtrack_challenges(p_year int)
returns table (event_id uuid, slug text, discipline text, gender char(1), starts_at timestamptz,
               lock_at timestamptz, points int, mine int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return query
    select e.id, e.slug, e.discipline, e.gender, e.starts_at, e.lock_at,
           case when e.lock_at <= now() then f.points end,
           case when e.lock_at <= now() and f.points is not null then
             (select s.points from score_events s
              where s.event_id = e.id and s.source = 'prediction' and s.user_id = auth.uid())
           end
    from frenchtrack_picks f
    join events e on e.id = f.event_id
    where extract(year from e.starts_at at time zone 'Europe/Paris') = p_year
    order by e.starts_at, e.id;
end $$;

-- « Qui bat FrenchTrack le plus souvent ? »: every score line of the computed challenges of a
-- season, with FrenchTrack's points and the pseudo and bib of the player, nothing else.
create function frenchtrack_season(p_year int)
returns table (event_id uuid, frenchtrack_points int, user_id uuid, pseudo text,
               bib_number smallint, bib_color text, points int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return query
    select e.id, f.points, s.user_id, p.pseudo, p.bib_number, p.bib_color, s.points
    from frenchtrack_picks f
    join events e on e.id = f.event_id
    join score_events s on s.event_id = e.id and s.source = 'prediction'
    join profiles p on p.id = s.user_id
    where f.points is not null and e.lock_at <= now()
      and extract(year from e.starts_at at time zone 'Europe/Paris') = p_year
      and not is_blocked(s.user_id)
    order by e.id, s.user_id;
end $$;

revoke execute on function admin_set_frenchtrack_pick(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function admin_remove_frenchtrack_pick(uuid) from public, anon;
revoke execute on function admin_set_frenchtrack_points(uuid, int) from public, anon;
revoke execute on function frenchtrack_challenge(uuid) from public, anon;
revoke execute on function frenchtrack_challenges(int) from public, anon;
revoke execute on function frenchtrack_season(int) from public, anon;
grant execute on function admin_set_frenchtrack_pick(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function admin_remove_frenchtrack_pick(uuid) to authenticated;
grant execute on function admin_set_frenchtrack_points(uuid, int) to authenticated;
grant execute on function frenchtrack_challenge(uuid) to authenticated;
grant execute on function frenchtrack_challenges(int) to authenticated;
grant execute on function frenchtrack_season(int) to authenticated;
