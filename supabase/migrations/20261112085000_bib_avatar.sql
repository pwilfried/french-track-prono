-- #537: the avatar becomes a bib, a number from 0 to 999 and one of six colours (the same list as
-- BIB_COLORS in src/domain/bib.ts). Several players may wear the same bib. Each existing player
-- gets one at random (number 1 to 99, any colour): a volatile default is drawn row by row. The
-- emoji goes away.

alter table profiles
  add column bib_number smallint not null default (1 + floor(random() * 99))::smallint
    constraint profiles_bib_number_range check (bib_number between 0 and 999),
  add column bib_color text not null
    default (array['blue', 'red', 'gold', 'green', 'white', 'night'])[1 + floor(random() * 6)::int]
    constraint profiles_bib_color_known
      check (bib_color in ('blue', 'red', 'gold', 'green', 'white', 'night'));

-- The back-office lists returned the emoji: they return the bib instead (new return types, so
-- the functions are dropped and created again, with the same rights).
drop function admin_list_players();

create function admin_list_players()
returns table (user_id uuid, pseudo text, bib_number smallint, bib_color text, blocked boolean,
               is_admin boolean, joined_at timestamptz, club text, points bigint,
               predictions bigint, leagues bigint, last_active_at timestamptz, reports bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin lists players' using errcode = '42501';
  end if;
  return query
  select p.id, p.pseudo, p.bib_number, p.bib_color, p.blocked_at is not null, p.is_admin,
         p.created_at, c.name,
         coalesce((select sum(s.points) from score_events s
                   where s.user_id = p.id and s.event_id is not null), 0)::bigint,
         (select count(*) from predictions r where r.user_id = p.id),
         (select count(*) from league_members m where m.user_id = p.id),
         private.last_activity(p.id),
         -- Reports received by the public leagues this player created.
         (select count(*) from league_reports lr join leagues l on l.id = lr.league_id
          where l.owner_id = p.id)
  from profiles p
  left join clubs c on c.id = p.club_id
  order by p.created_at desc, p.id;
end $$;
revoke execute on function admin_list_players() from public, anon;
grant execute on function admin_list_players() to authenticated;

drop function admin_league_members(uuid);

-- The members of a league with their points and rank: a member counts the events locked after
-- joining (same rule as countsInLeague in src/application/rankings.ts).
create function admin_league_members(p_league uuid)
returns table (user_id uuid, pseudo text, bib_number smallint, bib_color text, is_owner boolean,
               joined_at timestamptz, points bigint, rank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin reads the members of a league' using errcode = '42501';
  end if;
  return query
  with member_points as (
    select m.user_id, m.joined_at,
           coalesce(sum(s.points) filter (where e.lock_at >= m.joined_at), 0)::bigint as points
    from league_members m
    left join league_competitions lc on lc.league_id = m.league_id
    left join score_events s on s.user_id = m.user_id and s.competition_id = lc.competition_id
                             and s.event_id is not null
    left join events e on e.id = s.event_id
    where m.league_id = p_league
    group by m.user_id, m.joined_at
  )
  select mp.user_id, p.pseudo, p.bib_number, p.bib_color, l.owner_id = mp.user_id, mp.joined_at,
         mp.points, rank() over (order by mp.points desc)
  from member_points mp
  join profiles p on p.id = mp.user_id
  join leagues l on l.id = p_league
  order by mp.points desc, lower(p.pseudo);
end $$;
revoke execute on function admin_league_members(uuid) from public, anon;
grant execute on function admin_league_members(uuid) to authenticated;

alter table profiles drop column avatar_emoji;
