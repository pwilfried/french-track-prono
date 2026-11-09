-- #343: the admin finds a player, blocks or unblocks them, or deletes their account.
-- A blocked player predicts no more, creates or joins no league, and disappears from the
-- rankings (general and league) for the other players, until unblocked.

alter table profiles add column blocked_at timestamptz;

-- Only the admin functions below (security definer) change it, never a player through the API.
create function protect_blocked_flag() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
     and (case when tg_op = 'INSERT' then new.blocked_at is not null
               else new.blocked_at is distinct from old.blocked_at end) then
    raise exception 'blocked_at is set by the admin only' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger protect_blocked_flag
  before insert or update on profiles
  for each row execute function protect_blocked_flag();

create function is_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select blocked_at is not null from profiles where id = p_user), false)
$$;
grant execute on function is_blocked(uuid) to authenticated;

-- No prediction and no league for a blocked player.
create function refuse_blocked_player() returns trigger
language plpgsql set search_path = public as $$
begin
  -- auth.uid(): also through the security definer RPCs (create_league, join_league…).
  if auth.uid() is not null and is_blocked(new.user_id) then
    raise exception 'account blocked' using errcode = 'FT014';
  end if;
  return new;
end $$;

create trigger predictions_refuse_blocked
before insert or update on predictions
for each row execute function refuse_blocked_player();

create trigger league_members_refuse_blocked
before insert on league_members
for each row execute function refuse_blocked_player();

-- Out of the rankings: the other players read neither their score lines nor their membership.
drop policy read_all on score_events;
create policy read_all on score_events for select to authenticated
  using (user_id = auth.uid() or is_admin() or not is_blocked(user_id));

drop policy members_read on league_members;
create policy members_read on league_members for select to authenticated
  using (is_league_member(league_id) and (user_id = auth.uid() or not is_blocked(user_id)));

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player'));

-- Deleting an account, shared by the player (delete_my_account) and the admin.
create function private.delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_heir uuid;
begin
  for v_league in select id from leagues where owner_id = p_user loop
    select user_id into v_heir from league_members
    where league_id = v_league and user_id <> p_user
    order by joined_at, user_id limit 1;
    if v_heir is null then
      delete from leagues where id = v_league;
    else
      update leagues set owner_id = v_heir where id = v_league;
      update league_members set role = 'owner' where league_id = v_league and user_id = v_heir;
    end if;
  end loop;
  delete from auth.users where id = p_user;
end $$;
revoke execute on function private.delete_account(uuid) from public, anon, authenticated;

create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  perform private.delete_account(auth.uid());
end $$;

-- The players whose pseudo contains the query (accents and case ignored), 30 at most.
create function admin_search_players(p_query text)
returns table (user_id uuid, pseudo text, avatar text, blocked boolean, is_admin boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not is_admin() then
    raise exception 'only an admin searches players' using errcode = '42501';
  end if;
  return query
  select p.id, p.pseudo, p.avatar_emoji, p.blocked_at is not null, p.is_admin, p.created_at
  from profiles p
  where lower(extensions.unaccent(p.pseudo)) like
        '%' || lower(extensions.unaccent(trim(coalesce(p_query, '')))) || '%'
  order by p.blocked_at is null, lower(p.pseudo)
  limit 30;
end $$;
revoke execute on function admin_search_players(text) from public, anon;
grant execute on function admin_search_players(text) to authenticated;

create function admin_set_player_blocked(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_pseudo text;
begin
  if not is_admin() then
    raise exception 'only an admin blocks a player' using errcode = '42501';
  end if;
  select pseudo into v_pseudo from profiles where id = p_user and not is_admin;
  if v_pseudo is null then
    raise exception 'unknown player' using errcode = 'P0002';
  end if;
  update profiles set blocked_at = case when p_blocked then coalesce(blocked_at, now()) end
  where id = p_user;
  perform private.log_admin_action('moderate_player', null,
    jsonb_build_object('player', p_user, 'pseudo', v_pseudo,
                       'action', case when p_blocked then 'block' else 'unblock' end));
end $$;
revoke execute on function admin_set_player_blocked(uuid, boolean) from public, anon;
grant execute on function admin_set_player_blocked(uuid, boolean) to authenticated;

create function admin_delete_player(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pseudo text;
begin
  if not is_admin() then
    raise exception 'only an admin deletes a player' using errcode = '42501';
  end if;
  select pseudo into v_pseudo from profiles where id = p_user and not is_admin;
  if v_pseudo is null then
    raise exception 'unknown player' using errcode = 'P0002';
  end if;
  perform private.log_admin_action('moderate_player', null,
    jsonb_build_object('player', p_user, 'pseudo', v_pseudo, 'action', 'delete'));
  perform private.delete_account(p_user);
end $$;
revoke execute on function admin_delete_player(uuid) from public, anon;
grant execute on function admin_delete_player(uuid) to authenticated;
