-- #479: the back-office club search follows the same word rule as the sign-up club search.
-- The rule lives in one function, club_key_matches; search_clubs keeps its filters and its order,
-- admin_list_clubs keeps its own (clubs to validate included, « to validate » filter, limit).

-- True when every word of the query appears in the key, in any order (true for an empty query).
create function club_key_matches(p_key text, p_query text) returns boolean
language sql stable set search_path = public as $$
  select not exists (
    select 1
    from unnest(string_to_array(club_search_key(coalesce(p_query, '')), ' ')) w
    where w <> '' and position(w in p_key) = 0
  )
$$;

-- search_clubs is security invoker: the visitor of the sign-up form runs the rule too.
revoke execute on function club_key_matches(text, text) from public;
grant execute on function club_key_matches(text, text) to anon, authenticated, service_role;

create or replace function search_clubs(p_query text, p_limit int default 20)
returns table (id uuid, name text, city text, department text, validated boolean)
language sql stable security invoker set search_path = public as $$
  with q as (
    select array_remove(string_to_array(club_search_key(coalesce(p_query, '')), ' '), '') as words
  )
  select c.id, c.name, c.city, c.department, c.validated
  from clubs c, q
  where c.validated
    and cardinality(q.words) > 0
    and club_key_matches(c.search_key, p_query)
  order by (c.search_key like q.words[1] || '%') desc, c.name
  limit least(greatest(p_limit, 1), 50)
$$;

-- Clubs whose name and town hold every word of the query (all of them when empty), those to
-- validate first.
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
  order by c.validated, c.name
  limit least(greatest(coalesce(p_limit, 50), 1), 5000);
end $$;
