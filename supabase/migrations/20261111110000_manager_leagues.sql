-- French Track Manager, v0.12 (#419): a player creates a Manager league and becomes its admin.
-- Its own tables, apart from the prediction leagues: a Manager league has no prediction ranking.
-- At creation the league copies the rules in force and the eligible competitions (#418) and keeps
-- that copy: a later change of the rules does not touch it. 4 to 12 participants, an even number,
-- to start the season (src/domain/manager-league.ts); joining is #420.
-- Error codes: 42501 not signed in, FT010 banned name, 23514 name of the wrong length.

create table manager_leagues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 40),
  is_public       boolean not null default false,
  invite_code     text not null unique default new_invite_code(),
  owner_id        uuid not null references profiles(id) on delete cascade,
  rules           jsonb not null,
  competition_ids uuid[] not null default '{}',
  created_at      timestamptz not null default now()
);

create table manager_members (
  league_id uuid not null references manager_leagues(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index on manager_members (user_id);

-- Security definer: the policies below read manager_members without going through its policy.
create function is_manager_member(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from manager_members where league_id = p_league and user_id = auth.uid())
$$;
revoke execute on function is_manager_member(uuid) from public, anon;
grant execute on function is_manager_member(uuid) to authenticated;

alter table manager_leagues enable row level security;
alter table manager_members enable row level security;
create policy read_member on manager_leagues for select to authenticated
  using (is_manager_member(id));
create policy read_member on manager_members for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_leagues, manager_members from anon, authenticated;

create function create_manager_league(p_name text, p_public boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if is_banned_league_name(v_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  insert into manager_leagues (name, is_public, owner_id, rules, competition_ids)
  values (v_name, coalesce(p_public, false), auth.uid(),
          (select rules from manager_rules),
          coalesce((select array_agg(competition_id) from manager_competitions), '{}'))
  returning id into v_league;
  insert into manager_members (league_id, user_id) values (v_league, auth.uid());
  return v_league;
end $$;

revoke execute on function create_manager_league(text, boolean) from public, anon;
grant execute on function create_manager_league(text, boolean) to authenticated;
