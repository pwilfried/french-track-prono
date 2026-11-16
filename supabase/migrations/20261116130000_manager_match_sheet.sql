-- French Track Manager, the match sheet (#1032, decisions of the owner of 16 Nov. 2026, #1017).
-- A lineup becomes a match sheet: the starters (`lineup.max`, two per family), up to
-- `lineup.bench` substitutes in the order they come in, the rest of the team in reserve. Every
-- athlete of the sheet counts in one discipline, chosen among those of their start lists in the
-- competition (without any, those of their profile; relays left out); when none is chosen, the
-- first one counts (the main one first, then by name). A starter may have a designated
-- substitute, on the bench, of the same Manager family (a man or a woman), designated for them
-- only, and a tactical threshold: a mark in the unit of the discipline (seconds, metres, points,
-- as `mark_value` in athlete_records), plausible for the discipline (discipline_mark_range), which
-- needs a designated substitute. Same rules as lineupProblem in src/domain/manager-lineup.ts.
--
-- manager_lineups keeps the starters in place order (athlete_ids: the scores, duels and reminders
-- read it); manager_lineup_entries holds the sheet, one row per athlete. Lock and reading are
-- those of manager_lineups: no write after the lock (FT023), a player reads their own rows.
--
-- save_manager_lineup now takes the sheet as jsonb:
--   {"starters": [{"athlete": uuid, "discipline"?: text, "substitute"?: uuid, "threshold"?: number}],
--    "bench":    [{"athlete": uuid, "discipline"?: text}]}
-- Error codes: as before (42501, P0002, FT022, FT023; FT024 not a lineup: athletes, places), and
--   FT036 a discipline the athlete is not entered in    FT040 a threshold that is not plausible
--   FT037 a substitute of another family                FT041 more substitutes than the bench
--   FT038 a designated substitute not on the bench      FT042 a threshold without a substitute
--   FT039 a substitute designated for two starters

create table manager_lineup_entries (
  league_id      uuid not null,
  competition_id uuid not null,
  user_id        uuid not null,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  -- A starter and their place order (1 to lineup.max), or a substitute and their rank (1 to 4).
  role           text not null check (role in ('starter', 'substitute')),
  slot           int not null check (slot >= 1),
  discipline     text not null references disciplines(name) on update cascade,
  -- An athlete of the bench of the same sheet (checked by save_manager_lineup).
  substitute_id  uuid,
  -- In the unit of the discipline, as athlete_records.mark_value.
  threshold      numeric,
  primary key (league_id, competition_id, user_id, athlete_id),
  unique (league_id, competition_id, user_id, role, slot),
  foreign key (league_id, competition_id, user_id)
    references manager_lineups (league_id, competition_id, user_id) on delete cascade,
  check (role = 'starter' or (substitute_id is null and threshold is null)),
  check (threshold is null or substitute_id is not null)
);

alter table manager_lineup_entries enable row level security;
-- A player reads their own sheets; save_manager_lineup is the only way to write one.
create policy read_own on manager_lineup_entries for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete, truncate on manager_lineup_entries from anon, authenticated;

-- The disciplines an athlete may count in for the competition, the first one first: those of
-- their start lists there, else those of their profile; relays left out.
create function private.manager_discipline_options(p_competition uuid, p_athlete uuid)
returns table (discipline text, family text, unit text, rank int)
language sql stable security definer set search_path = public as $$
  with listed as (
    select distinct ev.discipline
    from entries en
    join events ev on ev.id = en.event_id
    join disciplines d on d.name = ev.discipline
    where ev.competition_id = p_competition and en.athlete_id = p_athlete and d.family <> 'relay'
  ), own as (
    select ad.discipline from athlete_disciplines ad where ad.athlete_id = p_athlete
  ), options as (
    select discipline from listed
    union
    select discipline from own where not exists (select 1 from listed)
  )
  select d.name, d.family, d.unit,
         (row_number() over (order by coalesce(ad.is_primary, false) desc, d.name))::int
  from options o
  join disciplines d on d.name = o.discipline and d.family <> 'relay'
  left join athlete_disciplines ad on ad.athlete_id = p_athlete and ad.discipline = d.name
$$;
revoke execute on function private.manager_discipline_options(uuid, uuid)
  from public, anon, authenticated;

-- The existing lineups become sheets of starters, each in their first discipline (before the
-- lock trigger: locked lineups get theirs too).
insert into manager_lineup_entries
  (league_id, competition_id, user_id, athlete_id, role, slot, discipline)
select ml.league_id, ml.competition_id, ml.user_id, a.id, 'starter', a.n::int, o.discipline
from manager_lineups ml
cross join lateral unnest(ml.athlete_ids) with ordinality as a(id, n)
join lateral (select * from private.manager_discipline_options(ml.competition_id, a.id)
              where rank = 1) o on true;

create trigger trg_manager_lineup_entry_lock
  before insert or update on manager_lineup_entries
  for each row execute function private.enforce_manager_lineup_lock();

-- The rows of a sheet whose shape is checked (manager_sheet_problem): role, slot, the
-- discipline that counts (null when the athlete is not entered in the one chosen), substitute and
-- threshold.
create function private.manager_sheet_rows(p_competition uuid, p_sheet jsonb)
returns table (athlete_id uuid, role text, slot int, discipline text, family text,
               unit text, substitute_id uuid, threshold numeric)
language sql stable security definer set search_path = public as $$
  with sheet as (
    select (x ->> 'athlete')::uuid as athlete_id, 'starter' as role, n::int as slot,
           x ->> 'discipline' as chosen, (x ->> 'substitute')::uuid as substitute_id,
           (x ->> 'threshold')::numeric as threshold
    from jsonb_array_elements(coalesce(p_sheet -> 'starters', '[]')) with ordinality s(x, n)
    union all
    select (x ->> 'athlete')::uuid, 'substitute', n::int, x ->> 'discipline', null, null
    from jsonb_array_elements(coalesce(p_sheet -> 'bench', '[]')) with ordinality b(x, n)
  )
  select s.athlete_id, s.role, s.slot, o.discipline, o.family, o.unit, s.substitute_id,
         s.threshold
  from sheet s
  left join lateral (
    select * from private.manager_discipline_options(p_competition, s.athlete_id) d
    where (s.chosen is null and d.rank = 1) or d.discipline = s.chosen
  ) o on true
$$;
revoke execute on function private.manager_sheet_rows(uuid, jsonb)
  from public, anon, authenticated;

-- Why the match sheet is not a lineup of the player for the competition, or null.
create function private.manager_sheet_problem(
  p_league uuid, p_user uuid, p_competition uuid, p_sheet jsonb
) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_uuid constant text :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_starters jsonb := coalesce(p_sheet -> 'starters', '[]');
  v_bench jsonb := coalesce(p_sheet -> 'bench', '[]');
  v_bench_size int := coalesce(
    (select (rules #>> '{lineup,bench}')::numeric::int from manager_leagues where id = p_league),
    0);
  v_ids uuid[];
  v_problem text;
begin
  -- The shape: two arrays of objects naming an athlete by id, a discipline by name, a
  -- substitute by id and a threshold by a number.
  if jsonb_typeof(coalesce(p_sheet, '{}')) <> 'object' or jsonb_typeof(v_starters) <> 'array'
     or jsonb_typeof(v_bench) <> 'array' then
    return 'not_in_team';
  end if;
  if exists (select 1 from (select x from jsonb_array_elements(v_starters) x
                            union all select x from jsonb_array_elements(v_bench) x) e(x)
             where jsonb_typeof(x) <> 'object'
                or coalesce(x ->> 'athlete', '') !~ v_uuid) then
    return 'not_in_team';
  end if;
  if exists (select 1 from (select x from jsonb_array_elements(v_starters) x
                            union all select x from jsonb_array_elements(v_bench) x) e(x)
             where jsonb_typeof(x -> 'discipline') not in ('string', 'null')) then
    return 'discipline_not_entered';
  end if;
  if exists (select 1 from jsonb_array_elements(v_starters) x
             where jsonb_typeof(x -> 'substitute') not in ('string', 'null')
                or (jsonb_typeof(x -> 'substitute') = 'string' and x ->> 'substitute' !~ v_uuid)) then
    return 'substitute_not_on_bench';
  end if;
  if exists (select 1 from jsonb_array_elements(v_starters) x
             where jsonb_typeof(x -> 'threshold') not in ('number', 'null')) then
    return 'implausible_threshold';
  end if;

  -- The athletes: of the team, each once on the sheet, entered.
  v_ids := array(select (x ->> 'athlete')::uuid from jsonb_array_elements(v_starters) x)
        || array(select (x ->> 'athlete')::uuid from jsonb_array_elements(v_bench) x);
  v_problem := private.manager_lineup_problem(p_league, p_user, p_competition, v_ids);
  if v_problem in ('not_in_team', 'twice', 'absent') then
    return v_problem;
  end if;
  if jsonb_array_length(v_bench) > v_bench_size then
    return 'bench_full';
  end if;
  if exists (select 1 from jsonb_array_elements(v_bench) x
             join private.manager_team(p_league, p_user) t on t.athlete_id = (x ->> 'athlete')::uuid
             where private.manager_family(t.family) is null) then
    return 'does_not_fit';
  end if;
  -- The starters fill the places.
  v_problem := private.manager_lineup_problem(
    p_league, p_user, p_competition,
    array(select (x ->> 'athlete')::uuid from jsonb_array_elements(v_starters) x));
  if v_problem is not null then
    return v_problem;
  end if;

  -- Disciplines, substitutes and thresholds.
  if exists (select 1 from private.manager_sheet_rows(p_competition, p_sheet)
             where discipline is null) then
    return 'discipline_not_entered';
  end if;
  if exists (select 1 from private.manager_sheet_rows(p_competition, p_sheet) s
             where s.substitute_id is not null
               and not exists (select 1 from jsonb_array_elements(v_bench) b
                               where (b ->> 'athlete')::uuid = s.substitute_id)) then
    return 'substitute_not_on_bench';
  end if;
  if exists (select 1 from private.manager_sheet_rows(p_competition, p_sheet) s
             join private.manager_team(p_league, p_user) ts on ts.athlete_id = s.athlete_id
             join private.manager_team(p_league, p_user) tb on tb.athlete_id = s.substitute_id
             where private.manager_family(ts.family)
                   is distinct from private.manager_family(tb.family)) then
    return 'substitute_other_family';
  end if;
  if (select count(substitute_id) <> count(distinct substitute_id)
      from private.manager_sheet_rows(p_competition, p_sheet)) then
    return 'substitute_twice';
  end if;
  if exists (select 1 from private.manager_sheet_rows(p_competition, p_sheet)
             where threshold is not null and substitute_id is null) then
    return 'threshold_without_substitute';
  end if;
  if exists (select 1 from private.manager_sheet_rows(p_competition, p_sheet) s
             cross join lateral discipline_mark_range(s.discipline, s.family, s.unit) r
             where s.threshold is not null and not (s.threshold between r.lo and r.hi)) then
    return 'implausible_threshold';
  end if;
  return null;
end $$;
revoke execute on function private.manager_sheet_problem(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- Validates the player's match sheet for an eligible competition of the league, or replaces it,
-- until the lock.
drop function save_manager_lineup(uuid, uuid, uuid[]);
create function save_manager_lineup(p_league uuid, p_competition uuid, p_sheet jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
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
  v_problem := private.manager_sheet_problem(p_league, auth.uid(), p_competition, p_sheet);
  if v_problem is not null then
    raise exception 'not a valid lineup: %', v_problem using errcode = case v_problem
      when 'discipline_not_entered' then 'FT036'
      when 'substitute_other_family' then 'FT037'
      when 'substitute_not_on_bench' then 'FT038'
      when 'substitute_twice' then 'FT039'
      when 'implausible_threshold' then 'FT040'
      when 'bench_full' then 'FT041'
      when 'threshold_without_substitute' then 'FT042'
      else 'FT024'
    end;
  end if;

  insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
  values (p_league, p_competition, auth.uid(),
          array(select (x ->> 'athlete')::uuid
                from jsonb_array_elements(coalesce(p_sheet -> 'starters', '[]'))
                     with ordinality s(x, n) order by n))
  on conflict (league_id, competition_id, user_id)
  do update set athlete_ids = excluded.athlete_ids, validated_at = now();
  delete from manager_lineup_entries
  where league_id = p_league and competition_id = p_competition and user_id = auth.uid();
  insert into manager_lineup_entries
    (league_id, competition_id, user_id, athlete_id, role, slot, discipline, substitute_id,
     threshold)
  select p_league, p_competition, auth.uid(), r.athlete_id, r.role, r.slot, r.discipline,
         r.substitute_id, r.threshold
  from private.manager_sheet_rows(p_competition, p_sheet) r;
end $$;
revoke execute on function save_manager_lineup(uuid, uuid, jsonb) from public, anon;
grant execute on function save_manager_lineup(uuid, uuid, jsonb) to authenticated;
