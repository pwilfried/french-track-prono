-- #382: the back-office list of players, with what the admin needs to understand each one,
-- and the leagues of a player with their rank in each. Never the e-mail address.

drop function admin_search_players(text);

create function admin_list_players()
returns table (user_id uuid, pseudo text, avatar text, blocked boolean, is_admin boolean,
               joined_at timestamptz, club text, points bigint, predictions bigint, leagues bigint,
               last_active_at timestamptz, reports bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin lists players' using errcode = '42501';
  end if;
  return query
  select p.id, p.pseudo, p.avatar_emoji, p.blocked_at is not null, p.is_admin, p.created_at,
         c.name,
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
  order by p.created_at desc
  limit 5000;
end $$;
revoke execute on function admin_list_players() from public, anon;
grant execute on function admin_list_players() to authenticated;

-- The leagues of a player and their rank in each: a member counts the events locked after
-- joining (same rule as countsInLeague in src/application/rankings.ts).
create function admin_player_leagues(p_user uuid)
returns table (league_id uuid, name text, member_count bigint, rank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin reads the leagues of a player' using errcode = '42501';
  end if;
  return query
  with member_points as (
    select m.league_id, m.user_id,
           coalesce(sum(s.points) filter (where e.lock_at >= m.joined_at), 0) as points
    from league_members m
    left join league_competitions lc on lc.league_id = m.league_id
    left join score_events s on s.user_id = m.user_id and s.competition_id = lc.competition_id
                             and s.event_id is not null
    left join events e on e.id = s.event_id
    where m.league_id in (select x.league_id from league_members x where x.user_id = p_user)
    group by m.league_id, m.user_id
  ), ranked as (
    select mp.league_id, mp.user_id,
           count(*) over (partition by mp.league_id) as member_count,
           rank() over (partition by mp.league_id order by mp.points desc) as rank
    from member_points mp
  )
  select l.id, l.name, r.member_count, r.rank
  from ranked r join leagues l on l.id = r.league_id
  where r.user_id = p_user
  order by r.rank, l.name;
end $$;
revoke execute on function admin_player_leagues(uuid) from public, anon;
grant execute on function admin_player_leagues(uuid) to authenticated;
