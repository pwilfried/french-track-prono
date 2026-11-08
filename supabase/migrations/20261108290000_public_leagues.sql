-- v0.7 (#277): public leagues, decided by the owner. Any player creates one; it is joined in one
-- tap, without a code, by up to 200 players (a private league keeps its code and 50 places).
-- Its name may not contain a banned word (insults, names that look official, links): the list is
-- the same as src/domain/league.ts (isBannedLeagueName).
-- Error codes: 42501 not signed in, P0002 unknown (or private) league, 54000 league full,
-- FT010 banned name.

create extension if not exists unaccent with schema extensions;

alter table leagues add column is_public boolean not null default false;

create function is_banned_league_name(p_name text) returns boolean
language plpgsql stable set search_path = public, extensions as $$
declare
  v_plain text := lower(extensions.unaccent(p_name));
  v_words text[] := '{}';
  v_token text;
  v_previous text := '';
begin
  if v_plain ~ '[a-z0-9-]+\.(com|fr|net|org|io|be|ch|info|bet)\M' then
    return true;
  end if;
  -- Letters typed apart ("F F A") are read as one word.
  foreach v_token in array regexp_split_to_array(v_plain, '[^a-z0-9]+') loop
    continue when v_token = '';
    if length(v_token) = 1 and length(v_previous) = 1 then
      v_words[cardinality(v_words)] := v_words[cardinality(v_words)] || v_token;
    else
      v_words := v_words || v_token;
    end if;
    v_previous := v_token;
  end loop;
  return exists (
    select 1 from unnest(v_words) w
    where w = any(array['con', 'cons', 'pd', 'fdp', 'ntm', 'ffa', 'www', 'http', 'https', 'pute', 'putes'])
       or w ~ '^(officiel|connard|encul|salop|merde|niqu|batard)'
  );
end $$;

drop function create_league(text, text[]);

create function create_league(p_name text, p_competition_slugs text[], p_public boolean default false)
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
  return query select v_league, v_code;
end $$;

revoke execute on function create_league(text, text[], boolean) from public, anon;
grant execute on function create_league(text, text[], boolean) to authenticated;

-- Adds the caller to a league (shared by both ways in): 50 places, 200 for a public league.
create function enter_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from league_members where league_id = p_league and user_id = auth.uid()) then
    return p_league;
  end if;
  if (select count(*) from league_members where league_id = p_league)
     >= (select case when is_public then 200 else 50 end from leagues where id = p_league) then
    raise exception 'league full' using errcode = '54000';
  end if;
  insert into league_members (league_id, user_id) values (p_league, auth.uid());
  return p_league;
end $$;
revoke execute on function enter_league(uuid) from public, anon, authenticated;

-- Joins with an invite code (case and spaces ignored). Joining twice changes nothing.
create or replace function join_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select id into v_league from leagues
  where invite_code = upper(regexp_replace(p_code, '\s', '', 'g'));
  if v_league is null then
    raise exception 'unknown invite code' using errcode = 'P0002';
  end if;
  return enter_league(v_league);
end $$;

-- Joins a public league in one tap, without its code.
create function join_public_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from leagues where id = p_league and is_public) then
    raise exception 'unknown public league' using errcode = 'P0002';
  end if;
  return enter_league(p_league);
end $$;
revoke execute on function join_public_league(uuid) from public, anon;
grant execute on function join_public_league(uuid) to authenticated;

-- The public leagues a player can join (row level security only shows a player his own leagues).
create function list_public_leagues()
returns table (league_id uuid, name text, member_count bigint, competition_slugs text[])
language sql stable security definer set search_path = public as $$
  select l.id, l.name,
         (select count(*) from league_members m where m.league_id = l.id),
         coalesce((select array_agg(c.slug order by c.slug) from league_competitions lc
                   join competitions c on c.id = lc.competition_id where lc.league_id = l.id), '{}')
  from leagues l
  where l.is_public
  order by l.name
$$;
revoke execute on function list_public_leagues() from public, anon;
grant execute on function list_public_leagues() to authenticated;
