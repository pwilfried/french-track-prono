-- v0.17 (#613): a league limited to event families (sprint, hurdles, throws…). The game outside
-- the leagues does not change: the predictions are the same everywhere, only the league ranking
-- leaves out the events of the other families. The ranking is computed in TypeScript
-- (src/domain/league-families.ts); the database keeps the families and their rules.
-- A league without family counts every event (« Toutes les épreuves », every league until now).
-- Error codes: 42501 not signed in or not the creator, FT029 a league on all events gets no
-- family, 23514 unknown family.

create table league_families (
  league_id uuid not null references leagues(id) on delete cascade,
  family    text not null check (family in ('sprint', 'hurdles', 'middle', 'long', 'jumps',
              'throws', 'combined', 'relay')),
  -- Null: chosen at creation, every event of the family counts. Otherwise added later (decision
  -- of the owner, 13 Nov 2026): only the events that start after it count.
  added_at  timestamptz,
  primary key (league_id, family)
);

-- Same rule as league_competitions: the members read, everything is written by the functions.
alter table league_families enable row level security;
create policy members_read on league_families for select to authenticated
  using (is_league_member(league_id));
revoke insert, update, delete, truncate on league_families from anon, authenticated;

drop function create_league(text, text[], boolean);

create function create_league(p_name text, p_competition_slugs text[], p_public boolean default false,
                              p_families text[] default '{}')
returns table (league_id uuid, invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_code text;
  v_wanted int := coalesce((select count(distinct s) from unnest(p_competition_slugs) s), 0);
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_public and is_banned_league_name(p_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  if (select count(*) from competitions where slug = any(p_competition_slugs)) <> v_wanted then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  insert into leagues (name, owner_id, is_public) values (trim(p_name), auth.uid(), p_public)
  returning id, leagues.invite_code into v_league, v_code;
  insert into league_members (league_id, user_id, role) values (v_league, auth.uid(), 'owner');
  insert into league_competitions (league_id, competition_id)
  select v_league, c.id from competitions c where c.slug = any(p_competition_slugs);
  insert into league_families (league_id, family)
  select distinct v_league, f from unnest(coalesce(p_families, '{}')) f;
  return query select v_league, v_code;
end $$;

revoke execute on function create_league(text, text[], boolean, text[]) from public, anon;
grant execute on function create_league(text, text[], boolean, text[]) to authenticated;

-- The creator adds a family; none is ever removed (the points won stay). Adding one twice keeps
-- its first date.
create function add_league_family(p_league uuid, p_family text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null
     or not exists (select 1 from leagues where id = p_league and owner_id = auth.uid()) then
    raise exception 'only the creator adds a family' using errcode = '42501';
  end if;
  if not exists (select 1 from league_families where league_id = p_league) then
    raise exception 'a league on all events counts every family' using errcode = 'FT029';
  end if;
  insert into league_families (league_id, family, added_at)
  values (p_league, p_family, now())
  on conflict do nothing;
end $$;

revoke execute on function add_league_family(uuid, text) from public, anon;
grant execute on function add_league_family(uuid, text) to authenticated;

-- The public leagues, with their families for the badge of their card.
drop function list_public_leagues();
create function list_public_leagues()
returns table (league_id uuid, name text, member_count bigint, competition_slugs text[],
               is_official boolean, families text[])
language sql stable security definer set search_path = public as $$
  select l.id, l.name,
         (select count(*) from league_members m where m.league_id = l.id),
         coalesce((select array_agg(c.slug order by c.slug) from league_competitions lc
                   join competitions c on c.id = lc.competition_id where lc.league_id = l.id), '{}'),
         l.is_official,
         coalesce((select array_agg(f.family order by f.family) from league_families f
                   where f.league_id = l.id), '{}')
  from leagues l
  where l.is_public
  order by l.name
$$;
revoke execute on function list_public_leagues() from public, anon;
grant execute on function list_public_leagues() to authenticated;
