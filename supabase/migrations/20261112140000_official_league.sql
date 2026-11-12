-- #553: one official public league, « Ligue FrenchTrack », on the European Championships. It is
-- owned by the admin account (who alone renames or deletes it, from the back-office), joined by
-- choice (no automatic sign-up) and has no member limit.

alter table leagues add column is_official boolean not null default false;
create unique index leagues_one_official on leagues ((true)) where is_official;

-- The cap of the public leagues (200) does not apply to the official one.
create or replace function enter_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from league_members where league_id = p_league and user_id = auth.uid()) then
    return p_league;
  end if;
  if (select not is_official from leagues where id = p_league)
     and (select count(*) from league_members where league_id = p_league)
         >= (select case when is_public then 200 else 50 end from leagues where id = p_league) then
    raise exception 'league full' using errcode = '54000';
  end if;
  insert into league_members (league_id, user_id) values (p_league, auth.uid());
  return p_league;
end $$;

-- The list says which public league is the official one.
drop function list_public_leagues();
create function list_public_leagues()
returns table (league_id uuid, name text, member_count bigint, competition_slugs text[],
               is_official boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.name,
         (select count(*) from league_members m where m.league_id = l.id),
         coalesce((select array_agg(c.slug order by c.slug) from league_competitions lc
                   join competitions c on c.id = lc.competition_id where lc.league_id = l.id), '{}'),
         l.is_official
  from leagues l
  where l.is_public
  order by l.name
$$;
revoke execute on function list_public_leagues() from public, anon;
grant execute on function list_public_leagues() to authenticated;

-- Creates the official league for the first admin account, once; nothing without an admin.
-- Rerun by hand (`select private.create_official_league();`) if the admin account comes later.
create function private.create_official_league() returns void
language plpgsql set search_path = public as $$
declare
  v_admin uuid := (select id from profiles where is_admin order by created_at, id limit 1);
  v_league uuid;
begin
  if v_admin is null or exists (select 1 from leagues where is_official) then
    return;
  end if;
  insert into leagues (name, owner_id, is_public, is_official)
  values ('Ligue FrenchTrack', v_admin, true, true)
  returning id into v_league;
  insert into league_members (league_id, user_id, role) values (v_league, v_admin, 'owner');
  insert into league_competitions (league_id, competition_id)
  select v_league, id from competitions where slug = 'european-championships-2026';
end $$;
revoke execute on function private.create_official_league() from public, anon, authenticated;

select private.create_official_league();
