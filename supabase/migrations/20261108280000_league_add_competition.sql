-- v0.7 (#312): a league can be created without competition, and its creator adds coming
-- competitions afterwards. Error codes: 42501 not signed in or not the creator, P0002 unknown
-- league or competition, FT009 competition already started.

create or replace function create_league(p_name text, p_competition_slugs text[])
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
  if (select count(*) from competitions where slug = any(p_competition_slugs)) <> v_wanted then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  insert into leagues (name, owner_id) values (trim(p_name), auth.uid())
  returning id, leagues.invite_code into v_league, v_code;
  insert into league_members (league_id, user_id, role) values (v_league, auth.uid(), 'owner');
  insert into league_competitions (league_id, competition_id)
  select v_league, c.id from competitions c where c.slug = any(p_competition_slugs);
  return query select v_league, v_code;
end $$;

create function add_league_competition(p_league uuid, p_competition_slug text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_competition uuid;
  v_starts date;
begin
  if auth.uid() is null
     or not exists (select 1 from leagues where id = p_league and owner_id = auth.uid()) then
    raise exception 'only the creator adds a competition' using errcode = '42501';
  end if;
  select id, starts_on into v_competition, v_starts from competitions where slug = p_competition_slug;
  if v_competition is null then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  if v_starts <= current_date then
    raise exception 'competition already started' using errcode = 'FT009';
  end if;
  insert into league_competitions (league_id, competition_id)
  values (p_league, v_competition)
  on conflict do nothing;
end $$;

revoke execute on function add_league_competition(uuid, text) from public, anon;
grant execute on function add_league_competition(uuid, text) to authenticated;
