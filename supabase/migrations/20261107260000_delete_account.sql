-- F13 (v0.7): a player deletes his account and everything attached to it (GDPR).
-- Deleting the auth user cascades to the profile, predictions, score lines, memberships, badges
-- and reactions. A league he owns goes to its oldest other member, or is deleted if he is alone.
create function delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_league uuid;
  v_heir uuid;
begin
  if v_me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  for v_league in select id from leagues where owner_id = v_me loop
    select user_id into v_heir from league_members
    where league_id = v_league and user_id <> v_me
    order by joined_at, user_id limit 1;
    if v_heir is null then
      delete from leagues where id = v_league;
    else
      update leagues set owner_id = v_heir where id = v_league;
      update league_members set role = 'owner' where league_id = v_league and user_id = v_heir;
    end if;
  end loop;
  delete from auth.users where id = v_me;
end $$;

revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
