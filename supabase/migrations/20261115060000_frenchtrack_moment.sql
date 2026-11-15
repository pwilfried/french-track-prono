-- #877 The « Battez FrenchTrack » moment of the community block: a challenge is dated by the first
-- computation of its points (a new computation keeps that date, so the moment is told once), and
-- the challenges of a season come with the points of every player, without any name, to tell the
-- share of players who beat FrenchTrack.
alter table frenchtrack_picks add column scored_at timestamptz;
update frenchtrack_picks set scored_at = updated_at where points is not null;

create or replace function admin_set_frenchtrack_pick(p_event uuid, p_p1 uuid, p_p2 uuid, p_p3 uuid)
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
    set p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, points = null, scored_at = null,
        updated_at = now();
end $$;

create or replace function admin_set_frenchtrack_points(p_event uuid, p_points int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin computes points' using errcode = '42501';
  end if;
  update frenchtrack_picks
    set points = p_points, scored_at = coalesce(scored_at, now())
    where event_id = p_event;
end $$;

-- The return type changes: the function is dropped, then created again with its rights.
drop function frenchtrack_challenges(int);

create function frenchtrack_challenges(p_year int)
returns table (event_id uuid, slug text, discipline text, gender char(1), starts_at timestamptz,
               lock_at timestamptz, points int, mine int, scored_at timestamptz, scores int[])
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
           end,
           case when e.lock_at <= now() and f.points is not null then f.scored_at end,
           case when e.lock_at <= now() and f.points is not null then
             array(select s.points from score_events s
                   where s.event_id = e.id and s.source = 'prediction'
                     and not is_blocked(s.user_id)
                   order by s.points)
           else '{}'::int[] end
    from frenchtrack_picks f
    join events e on e.id = f.event_id
    where extract(year from e.starts_at at time zone 'Europe/Paris') = p_year
    order by e.starts_at, e.id;
end $$;

revoke execute on function frenchtrack_challenges(int) from public, anon;
grant execute on function frenchtrack_challenges(int) to authenticated;
