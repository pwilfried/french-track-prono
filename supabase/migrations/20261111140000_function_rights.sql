-- #457: execution rights of the database functions, after the Supabase security advisor.
-- The rule for every function (docs/architecture.md, « Fonctions SQL »), checked by
-- supabase/tests/function_rights.test.sql, which reads pg_proc and so holds for future functions:
--   * a fixed search_path;
--   * a trigger function is executable by nobody through the API (a trigger runs it all the same);
--   * anon executes only the functions of the list written in the test, each with its reason;
--   * an admin_ function, and a security definer function that writes, checks the caller first
--     (42501).
-- Nothing changes for a visitor, a player or an admin.

-- 1. A fixed search_path for the functions written before the rule.
alter function enforce_prediction_lock() set search_path = public;
alter function protect_admin_flag() set search_path = public;
alter function protect_blocked_flag() set search_path = public;
alter function protect_inactivity_flag() set search_path = public;
alter function parse_mark(text) set search_path = public;
alter function lower_is_better(text) set search_path = public;
alter function is_better_mark(text, numeric, numeric) set search_path = public;

-- 2. Trigger functions: no execution right for the API roles. Postgres checks the right when the
-- trigger is created (by the owner), never when it fires.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'trigger'::regtype
      and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 3. anon: only the functions a visitor needs. No row level security policy open to anon calls a
-- function of public (they use true and auth.uid() only), so the public reads are untouched.
-- The club picker searches before the account exists; search_clubs is security invoker, so the
-- visitor also runs club_search_key.
revoke execute on function search_clubs(text, int), club_search_key(text) from public;
grant execute on function search_clubs(text, int), club_search_key(text)
  to anon, authenticated, service_role;

-- Every other function loses anon and public; authenticated and service_role keep what they had.
do $$
declare
  f regprocedure;
  v_authenticated boolean;
  v_service boolean;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind in ('f', 'p')
      and p.oid not in ('search_clubs(text, int)'::regprocedure, 'club_search_key(text)'::regprocedure)
      and not exists (select 1 from pg_depend d
                      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    v_authenticated := has_function_privilege('authenticated', f::oid, 'execute');
    v_service := has_function_privilege('service_role', f::oid, 'execute');
    execute format('revoke execute on function %s from public, anon', f);
    if v_authenticated then
      execute format('grant execute on function %s to authenticated', f);
    end if;
    if v_service then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- A function created from now on is not executable by anon (nor by every role through public)
-- until a migration grants it; authenticated and service_role keep the Supabase default.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- 4. Security definer functions that write: a caller without identity is refused (42501), as
-- the other player functions already do. Same behaviour for a signed-in player.
create or replace function leave_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from leagues where id = p_league and owner_id = auth.uid()) then
    if exists (select 1 from league_members where league_id = p_league and user_id <> auth.uid()) then
      raise exception 'hand the league over first' using errcode = '2BP01';
    end if;
    delete from leagues where id = p_league;
  else
    delete from league_members where league_id = p_league and user_id = auth.uid();
  end if;
end $$;

create or replace function dismiss_club_notice(p_notice uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  update club_notices set seen_at = now() where id = p_notice and profile_id = auth.uid();
end $$;

create or replace function delete_push_subscription(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $$;
