-- #383: the back-office sees every league, dismisses reports, reads the members with their
-- rank and removes a member. Each action is logged.

create function admin_list_leagues()
returns table (league_id uuid, name text, emoji text, is_public boolean, owner text,
               created_at timestamptz, member_count bigint, report_count bigint,
               competitions text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin lists leagues' using errcode = '42501';
  end if;
  return query
  select l.id, l.name, l.emoji, l.is_public, p.pseudo, l.created_at,
         (select count(*) from league_members m where m.league_id = l.id),
         (select count(*) from league_reports r where r.league_id = l.id),
         coalesce((select array_agg(c.name order by c.starts_on)
                   from league_competitions lc join competitions c on c.id = lc.competition_id
                   where lc.league_id = l.id), '{}')
  from leagues l
  left join profiles p on p.id = l.owner_id
  order by l.created_at desc
  limit 5000;
end $$;
revoke execute on function admin_list_leagues() from public, anon;
grant execute on function admin_list_leagues() to authenticated;

-- The reports were unfounded: they are cleared, the league stays as it is.
create function admin_dismiss_league_reports(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then
    raise exception 'only an admin dismisses reports' using errcode = '42501';
  end if;
  select name into v_name from leagues where id = p_league;
  if v_name is null then
    raise exception 'unknown league' using errcode = 'P0002';
  end if;
  delete from league_reports where league_id = p_league;
  perform private.log_admin_action('moderate_league', null,
    jsonb_build_object('league', p_league, 'name', v_name, 'action', 'dismiss_reports'));
end $$;
revoke execute on function admin_dismiss_league_reports(uuid) from public, anon;
grant execute on function admin_dismiss_league_reports(uuid) to authenticated;

-- The members of a league with their points and rank: a member counts the events locked after
-- joining (same rule as countsInLeague in src/application/rankings.ts).
create function admin_league_members(p_league uuid)
returns table (user_id uuid, pseudo text, avatar text, is_owner boolean, joined_at timestamptz,
               points bigint, rank bigint)
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
  select mp.user_id, p.pseudo, p.avatar_emoji, l.owner_id = mp.user_id, mp.joined_at, mp.points,
         rank() over (order by mp.points desc)
  from member_points mp
  join profiles p on p.id = mp.user_id
  join leagues l on l.id = p_league
  order by mp.points desc, lower(p.pseudo);
end $$;
revoke execute on function admin_league_members(uuid) from public, anon;
grant execute on function admin_league_members(uuid) to authenticated;

-- The admin removes a member; the owner hands the league over or the admin deletes it instead.
create function admin_remove_league_member(p_league uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_owner uuid;
  v_pseudo text;
begin
  if not is_admin() then
    raise exception 'only an admin removes a member' using errcode = '42501';
  end if;
  select name, owner_id into v_name, v_owner from leagues where id = p_league;
  select pseudo into v_pseudo from profiles where id = p_user;
  if v_name is null or v_pseudo is null
     or not exists (select 1 from league_members where league_id = p_league and user_id = p_user) then
    raise exception 'unknown member' using errcode = 'P0002';
  end if;
  if v_owner = p_user then
    raise exception 'the owner cannot be removed' using errcode = '2BP01';
  end if;
  delete from league_members where league_id = p_league and user_id = p_user;
  perform private.log_admin_action('moderate_league', null,
    jsonb_build_object('league', p_league, 'name', v_name, 'action', 'remove_member',
                       'player', p_user, 'pseudo', v_pseudo));
end $$;
revoke execute on function admin_remove_league_member(uuid, uuid) from public, anon;
grant execute on function admin_remove_league_member(uuid, uuid) to authenticated;

-- Replaced by admin_list_leagues(), which gives the reports of every league.
drop function admin_list_reported_leagues();
