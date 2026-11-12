-- French Track Manager, v0.14 (#427): before each eligible competition of the league, a participant
-- lines up athletes of their team. The stadium holds `lineup.max` places of the league's rules: so
-- many per family, from `lineup.minPerFamily` (hurdles count as sprint, both jumps together, as on
-- the cards), the rest free for any family. A lineup holds athletes of the player's team, each
-- once, entered in the competition (competition_athletes), and fills every place the
-- team can fill: a place nobody can fill (incomplete team, athletes absent) stays empty. Same rule
-- as lineupProblem in src/domain/manager-lineup.ts.
-- The lineup is locked at the first prediction lock of the competition (the day it starts at
-- midnight, Paris time, while it has no events): the database refuses any change from then on,
-- as it does for predictions. A row is a validated lineup; without one at the lock, the player
-- scores 0 for the competition (v0.15).
-- Error codes: 42501 not a participant, P0002 not an eligible competition of the league,
-- FT022 mercato not over, FT023 lineup locked, FT024 not a valid lineup.

create table manager_lineups (
  league_id      uuid not null,
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id        uuid not null,
  athlete_ids    uuid[] not null,
  validated_at   timestamptz not null default now(),
  primary key (league_id, competition_id, user_id),
  foreign key (league_id, user_id) references manager_members (league_id, user_id) on delete cascade
);

alter table manager_lineups enable row level security;
-- A player reads their own lineups; save_manager_lineup is the only way to write one.
create policy read_own on manager_lineups for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete, truncate on manager_lineups from anon, authenticated;

-- The group of a family on the cards and in the stadium (cardGroupOf in src/domain/manager-team.ts).
create function private.manager_card_group(p_family text) returns text
language sql immutable set search_path = public as $$
  select case p_family
    when 'hurdles' then 'sprint'
    when 'relay' then 'sprint'
    when 'horizontal_jumps' then 'jumps'
    when 'vertical_jumps' then 'jumps'
    else p_family
  end
$$;
revoke execute on function private.manager_card_group(text) from public, anon, authenticated;

-- When the lineups of a competition lock.
create function private.manager_lineup_lock(p_competition uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select min(e.lock_at) from events e where e.competition_id = p_competition),
    (select c.starts_on::timestamp at time zone 'Europe/Paris'
     from competitions c where c.id = p_competition))
$$;
revoke execute on function private.manager_lineup_lock(uuid) from public, anon, authenticated;

-- Whether an athlete is entered in the competition (back-office list, filled by the start lists too).
create function private.manager_entered(p_competition uuid, p_athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from competition_athletes
                 where competition_id = p_competition and athlete_id = p_athlete)
$$;
revoke execute on function private.manager_entered(uuid, uuid) from public, anon, authenticated;

-- No lineup is written or changed once the competition has started. A delete only comes from a
-- cascade (league, account or competition removed): the lock does not hold it back.
create function private.enforce_manager_lineup_lock() returns trigger
language plpgsql set search_path = public as $$
begin
  if now() >= private.manager_lineup_lock(new.competition_id) then
    raise exception 'lineup locked: the competition has started' using errcode = 'FT023';
  end if;
  return new;
end $$;
revoke execute on function private.enforce_manager_lineup_lock() from public, anon, authenticated;

create trigger trg_manager_lineup_lock
  before insert or update on manager_lineups
  for each row execute function private.enforce_manager_lineup_lock();

-- Why the chosen athletes are not a lineup of the player for the competition, or null.
create function private.manager_lineup_problem(
  p_league uuid, p_user uuid, p_competition uuid, p_chosen uuid[]
) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_lineup jsonb := (select rules -> 'lineup' from manager_leagues where id = p_league);
  v_family_places int;
  v_free int;
  v_group_fill int;
  v_excess int;
  v_overflow int;
begin
  if exists (select 1 from unnest(p_chosen) c(id)
             where c.id is null
                or not exists (select 1 from private.manager_team(p_league, p_user) t
                               where t.athlete_id = c.id)) then
    return 'not_in_team';
  end if;
  if cardinality(p_chosen) <> (select count(distinct c.id) from unnest(p_chosen) c(id)) then
    return 'twice';
  end if;
  if exists (select 1 from unnest(p_chosen) c(id)
             where not private.manager_entered(p_competition, c.id)) then
    return 'absent';
  end if;

  -- Per group: its places, the athletes of the team entered, the athletes chosen.
  with places as (
    select private.manager_card_group(m.key) as grp, sum((m.value)::numeric::int) as n
    from jsonb_each_text(coalesce(v_lineup -> 'minPerFamily', '{}'::jsonb)) m
    group by 1
  ), team as (
    select private.manager_card_group(t.family) as grp,
           private.manager_entered(p_competition, t.athlete_id) as entered,
           t.athlete_id = any(p_chosen) as chosen
    from private.manager_team(p_league, p_user) t
  ), per_group as (
    select coalesce(p.n, 0) as n,
           (select count(*) from team t where t.grp = g.grp and t.entered) as entered,
           (select count(*) from team t where t.grp = g.grp and t.chosen) as chosen
    from (select grp from places union select grp from team) g
    left join places p on p.grp = g.grp
  )
  select coalesce(sum(n), 0),
         coalesce(sum(least(entered, n)), 0),
         coalesce(sum(greatest(0, entered - n)), 0),
         coalesce(sum(greatest(0, chosen - n)), 0)
  into v_family_places, v_group_fill, v_excess, v_overflow
  from per_group;

  v_free := greatest(0, (v_lineup ->> 'max')::numeric::int - v_family_places);
  -- Athletes beyond the places of their family sit on free places.
  if v_overflow > v_free then
    return 'does_not_fit';
  end if;
  -- Every place the team can fill is filled.
  if cardinality(p_chosen) < v_group_fill + least(v_free, v_excess) then
    return 'incomplete';
  end if;
  return null;
end $$;
revoke execute on function private.manager_lineup_problem(uuid, uuid, uuid, uuid[])
  from public, anon, authenticated;

-- Validates the player's lineup for an eligible competition of the league, or replaces it, until
-- the lock.
create function save_manager_lineup(p_league uuid, p_competition uuid, p_athletes uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_chosen uuid[] := coalesce(p_athletes, '{}');
  v_eligible boolean;
  v_closed timestamptz;
  v_problem text;
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant lines up athletes' using errcode = '42501';
  end if;
  select coalesce(p_competition = any(competition_ids), false), mercato_closed_at
  into v_eligible, v_closed
  from manager_leagues where id = p_league;
  if not v_eligible then
    raise exception 'not an eligible competition of the league' using errcode = 'P0002';
  end if;
  if v_closed is null then
    raise exception 'the mercato is not over' using errcode = 'FT022';
  end if;
  if now() >= private.manager_lineup_lock(p_competition) then
    raise exception 'lineup locked: the competition has started' using errcode = 'FT023';
  end if;
  v_problem := private.manager_lineup_problem(p_league, auth.uid(), p_competition, v_chosen);
  if v_problem is not null then
    raise exception 'not a valid lineup: %', v_problem using errcode = 'FT024';
  end if;
  insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
  values (p_league, p_competition, auth.uid(), v_chosen)
  on conflict (league_id, competition_id, user_id)
  do update set athlete_ids = excluded.athlete_ids, validated_at = now();
end $$;
revoke execute on function save_manager_lineup(uuid, uuid, uuid[]) from public, anon;
grant execute on function save_manager_lineup(uuid, uuid, uuid[]) to authenticated;

-- The eligible competitions of the league, first one first, with their lock, the athletes of the
-- player's team entered in them, and the player's validated lineup (null athlete_ids without one).
create function my_manager_lineups(p_league uuid)
returns table (competition_id uuid, slug text, name text, starts_on date, lock_at timestamptz,
               entered uuid[], athlete_ids uuid[], validated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant reads their lineups' using errcode = '42501';
  end if;
  return query
  select c.id, c.slug, c.name, c.starts_on, private.manager_lineup_lock(c.id),
         coalesce((select array_agg(w.athlete_id order by w.athlete_id)
                   from manager_awards w
                   where w.league_id = p_league and w.user_id = auth.uid()
                     and private.manager_entered(c.id, w.athlete_id)), '{}'::uuid[]),
         ml.athlete_ids, ml.validated_at
  from manager_leagues l
  cross join lateral unnest(l.competition_ids) as e(id)
  join competitions c on c.id = e.id
  left join manager_lineups ml
    on ml.league_id = l.id and ml.competition_id = c.id and ml.user_id = auth.uid()
  where l.id = p_league
  order by c.starts_on, c.name;
end $$;
revoke execute on function my_manager_lineups(uuid) from public, anon;
grant execute on function my_manager_lineups(uuid) to authenticated;
