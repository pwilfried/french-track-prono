-- pgTAP: execution rights of the database functions (#457). Every check reads pg_proc, so a function
-- added later is held to the same rule (docs/architecture.md, « Fonctions SQL »).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(7);

-- Our functions: those of public and private, not those of an extension (pgTAP, pgcrypto…).
create view pg_temp.our_functions as
select p.oid,
       p.oid::regprocedure::text as signature,
       p.proname::text as name,
       n.nspname::text as schema,
       p.prorettype = 'trigger'::regtype as is_trigger,
       p.prosecdef as is_definer,
       p.provolatile = 'v' as is_volatile
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.prokind in ('f', 'p')
  and not exists (select 1 from pg_depend d
                  where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e');

-- `select fn(null::type, …)`: every argument null.
create function pg_temp.call_with_nulls(p_fn oid) returns text language sql stable as $$
  select format('select %I.%I(%s)', n.nspname, p.proname,
                coalesce((select string_agg(format('null::%s', format_type(t.type, null)), ', ' order by t.n)
                          from unnest(p.proargtypes::oid[]) with ordinality as t(type, n)), ''))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.oid = p_fn
$$;

-- The error code the statement raises when run as p_role for p_user (null: no identity).
-- 'none' when it raises nothing. Its writes, the role and the claims are rolled back either way.
create function pg_temp.error_code(p_role text, p_user uuid, p_sql text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '' else json_build_object('sub', p_user, 'role', p_role)::text end,
    true);
  perform set_config('role', p_role, true);
  execute p_sql;
  raise exception 'no error' using errcode = 'FT999';
exception when others then
  return case when sqlstate = 'FT999' then 'none' else sqlstate end;
end $$;

insert into auth.users (id, email) values ('f1f10000-0000-0000-0000-000000000001', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin)
  values ('f1f10000-0000-0000-0000-000000000001', 'Joueur Lambda', now(), false);

select is_empty(
  $$select signature from pg_temp.our_functions
    where not exists (select 1 from pg_proc p, unnest(coalesce(p.proconfig, '{}')) c
                      where p.oid = our_functions.oid and c like 'search_path=%')$$,
  'every function has a fixed search_path');

select is_empty(
  $$select signature || ' → ' || r.role from pg_temp.our_functions f,
           (values ('anon'), ('authenticated')) as r(role)
    where f.schema = 'public' and f.is_trigger and has_function_privilege(r.role, f.oid, 'execute')
    union all
    select signature || ' → public' from pg_temp.our_functions f
    where f.schema = 'public' and f.is_trigger
      and exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  where p.oid = f.oid and a.grantee = 0 and a.privilege_type = 'EXECUTE')$$,
  'no trigger function is executable by anon, authenticated or public');

select set_eq(
  $$select signature from pg_temp.our_functions
    where schema = 'public' and has_function_privilege('anon', oid, 'execute')$$,
  array[
    -- The club picker of the sign-up form searches before the account exists.
    'search_clubs(text,integer)',
    -- Called by search_clubs, which is security invoker: it runs with the visitor's rights.
    'club_search_key(text)'
  ],
  'anon executes only the functions of the list');

select is_empty(
  $$select signature || ' → ' || pg_temp.error_code('authenticated', 'f1f10000-0000-0000-0000-000000000001',
                                                    pg_temp.call_with_nulls(oid))
    from pg_temp.our_functions
    where schema = 'public' and name like 'admin\_%'
      and pg_temp.error_code('authenticated', 'f1f10000-0000-0000-0000-000000000001',
                             pg_temp.call_with_nulls(oid)) <> '42501'$$,
  'every admin_ function refuses a player who is not an admin (42501)');

select is_empty(
  $$select signature || ' → ' || pg_temp.error_code('authenticated', null, pg_temp.call_with_nulls(oid))
    from pg_temp.our_functions
    where schema = 'public' and is_definer and is_volatile and not is_trigger
      and has_function_privilege('authenticated', oid, 'execute')
      and pg_temp.error_code('authenticated', null, pg_temp.call_with_nulls(oid)) <> '42501'$$,
  'every security definer function that writes refuses a caller without identity (42501)');

-- A function created from now on: not for anon until a migration grants it.
create function public.function_rights_probe() returns int language sql set search_path = public as $$
  select 1
$$;
select ok(not has_function_privilege('anon', 'public.function_rights_probe()', 'execute'),
  'a new function is not executable by anon by default');
select ok(has_function_privilege('authenticated', 'public.function_rights_probe()', 'execute'),
  'a new function stays executable by authenticated by default');

select * from finish();
rollback;
