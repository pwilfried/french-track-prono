-- #508: the back-office lists read every row. The API answers at most max_rows (1,000) rows, so
-- the adapters read a page at a time (src/infra/supabase/read-all.ts); for that the lists need a
-- total order (the id breaks ties) and no cap of their own.

-- A null p_limit lists every club; the default stays 50 (the search of a form).
create or replace function admin_list_clubs(p_query text, p_pending_only boolean default false,
                                            p_limit int default 50)
returns table (id uuid, name text, city text, department text, source text, validated boolean,
               player_count bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.city, c.department, c.source, c.validated,
         (select count(*) from profiles p where p.club_id = c.id), c.created_at
  from clubs c
  where (not p_pending_only or not c.validated)
    and club_key_matches(c.search_key, p_query)
  order by c.validated, c.name, c.id
  limit case when p_limit is null then null else least(greatest(p_limit, 1), 5000) end;
end $$;

create or replace function admin_list_players()
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
  order by p.created_at desc, p.id;
end $$;

create or replace function admin_list_leagues()
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
  order by l.created_at desc, l.id;
end $$;
