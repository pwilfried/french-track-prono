-- #912: a signed-in player reads only the public face of the other profiles (pseudo, bib, club,
-- sign-up date). Column privileges cannot tell one row from another, so the private columns
-- (is_admin, blocked_at, age_confirmed_at, inactivity_warned_at…) go through read_profile():
-- the player reads their own whole profile, the admin anyone's. The admin_* functions are
-- security definer and keep reading every column.

revoke select on profiles from authenticated;
grant select (id, pseudo, bib_number, bib_color, club_id, created_at) on profiles to authenticated;

create function read_profile(p_user uuid) returns setof profiles
language sql stable security definer set search_path = public as $$
  select p.* from profiles p
  where p.id = p_user and (p_user = auth.uid() or is_admin())
$$;
revoke execute on function read_profile(uuid) from public, anon;
grant execute on function read_profile(uuid) to authenticated;
