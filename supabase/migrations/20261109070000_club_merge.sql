-- #381: the back-office list shows every club (with its date), and the admin merges a duplicate
-- into the right club: its players move over and learn it once.

alter table club_notices drop constraint club_notices_kind_check;
alter table club_notices add constraint club_notices_kind_check
  check (kind in ('validated', 'renamed', 'removed', 'merged'));

drop function admin_list_clubs(text, boolean);

-- Clubs whose name or town contains the query (all of them when empty), those to validate first.
create function admin_list_clubs(p_query text, p_pending_only boolean default false,
                                 p_limit int default 50)
returns table (id uuid, name text, city text, department text, source text, validated boolean,
               player_count bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_key text := club_search_key(coalesce(p_query, ''));
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.city, c.department, c.source, c.validated,
         (select count(*) from profiles p where p.club_id = c.id), c.created_at
  from clubs c
  where (not p_pending_only or not c.validated)
    and (v_key = '' or c.search_key like '%' || v_key || '%')
  order by c.validated, c.name
  limit least(greatest(coalesce(p_limit, 50), 1), 5000);
end $$;

-- Moves the players of p_from to p_into, tells them, then deletes p_from. Returns the players moved.
create function admin_merge_club(p_from uuid, p_into uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_from text;
  v_into text;
  v_moved int;
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  if p_from = p_into then
    raise exception 'a club cannot be merged into itself' using errcode = '22023';
  end if;
  select name into v_from from clubs where id = p_from for update;
  select name into v_into from clubs where id = p_into for update;
  if v_from is null or v_into is null then
    raise exception 'unknown club' using errcode = 'P0002';
  end if;
  -- The club kept is the reference: merging into it validates it (players see it again).
  update clubs set validated = true where id = p_into and not validated;
  insert into club_notices (profile_id, kind, club_name, new_name)
  select p.id, 'merged', v_from, v_into from profiles p where p.club_id = p_from;
  update profiles set club_id = p_into where club_id = p_from;
  get diagnostics v_moved = row_count;
  -- No player is left on it: the delete trigger writes no « removed » notice.
  delete from clubs where id = p_from;
  perform private.log_admin_action('moderate_club', null,
    jsonb_build_object('club', p_from, 'name', v_from, 'action', 'merge', 'into', p_into,
                       'into_name', v_into, 'players', v_moved));
  return v_moved;
end $$;

revoke execute on function admin_list_clubs(text, boolean, int) from public, anon;
revoke execute on function admin_merge_club(uuid, uuid) from public, anon;
grant execute on function admin_list_clubs(text, boolean, int) to authenticated;
grant execute on function admin_merge_club(uuid, uuid) to authenticated;
