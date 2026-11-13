-- « Découvrir » sorts the public leagues by creation, the latest first (#662).
drop function list_public_leagues();
create function list_public_leagues()
returns table (league_id uuid, name text, member_count bigint, competition_slugs text[],
               is_official boolean, families text[], created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.name,
         (select count(*) from league_members m where m.league_id = l.id),
         coalesce((select array_agg(c.slug order by c.slug) from league_competitions lc
                   join competitions c on c.id = lc.competition_id where lc.league_id = l.id), '{}'),
         l.is_official,
         coalesce((select array_agg(f.family order by f.family) from league_families f
                   where f.league_id = l.id), '{}'),
         l.created_at
  from leagues l
  where l.is_public
  order by l.name
$$;
revoke execute on function list_public_leagues() from public, anon;
grant execute on function list_public_leagues() to authenticated;
