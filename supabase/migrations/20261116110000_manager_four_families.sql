-- French Track Manager (#1030, decisions of the owner of 16 Nov. 2026, #1017): four families,
-- the same for the team and the stadium — sprint (100 to 400 m, hurdles), distance (800 m to the
-- marathon, steeplechase), jumps (all four, combined events included), throws. Same rules as
-- src/domain/manager-rules.ts (managerFamilyOf, isPlayableManagerRules).
--   quotas         one per family: {family, min, minPerSex, maxPerSex}; at least `min` athletes of
--                  the family, of each sex at least `minPerSex` and at most `maxPerSex`.
--   lineup         {max, perFamily, bench}: `perFamily` places per family, no free place; `bench`
--                  ordered substitutes (the match sheet, #1032).
--   tablesDivisor  the World Athletics points of an athlete are divided by it (the score, #1031).
-- The leagues whose mercato has not opened take the new rules (they keep their rounds, which
-- their creator may have chosen). The others keep theirs, with their families mapped, a
-- divisor of 10 and a bench of 4.

-- The Manager family of a discipline family; null for relays.
create function private.manager_family(p_family text) returns text
language sql immutable set search_path = public as $$
  select case p_family
    when 'sprint' then 'sprint'
    when 'hurdles' then 'sprint'
    when 'middle' then 'distance'
    when 'long' then 'distance'
    when 'horizontal_jumps' then 'jumps'
    when 'vertical_jumps' then 'jumps'
    when 'combined' then 'jumps'
    when 'throws' then 'throws'
  end
$$;
revoke execute on function private.manager_family(text) from public, anon, authenticated;

-- Old rules mapped to the four families: per family, the minimums of both sexes add up into
-- `min`, the smaller sum of a sex (0 when one sex had no quota) is `minPerSex`, the larger sum of
-- maximums is `maxPerSex`. The lineup keeps its size in places per family (at least one).
create function private.manager_rules_four_families(p_rules jsonb) returns jsonb
language sql immutable set search_path = public as $$
  with old as (
    select private.manager_family(q ->> 'family') as family, q ->> 'sex' as sex,
           sum((q ->> 'min')::numeric::int) as min, sum((q ->> 'max')::numeric::int) as max
    from jsonb_array_elements(coalesce(p_rules -> 'quotas', '[]'::jsonb)) q
    where private.manager_family(q ->> 'family') is not null
    group by 1, 2
  ), mapped as (
    select family, sum(min) as min,
           case when count(*) = 2 then min(min) else 0 end as min_per_sex,
           max(max) as max_per_sex
    from old group by family
  ), per_family as (
    select greatest(1, coalesce((p_rules #>> '{lineup,max}')::numeric::int, 0) / 4) as n
  )
  select p_rules
    || jsonb_build_object(
         'quotas', coalesce((
           select jsonb_agg(jsonb_build_object('family', family, 'min', min,
                                               'minPerSex', min_per_sex,
                                               'maxPerSex', max_per_sex)
                            order by array_position(array['sprint', 'distance', 'jumps', 'throws'],
                                                    family))
           from mapped), '[]'::jsonb),
         'lineup', (select jsonb_build_object('max', n * 4, 'perFamily', n, 'bench', 4)
                    from per_family),
         'tablesDivisor', 10)
$$;

-- The new defaults; the admin's mercato rounds, close modes, bonuses and season stay.
update manager_rules
set rules = rules || '{
  "budget": 100,
  "minTeamSize": 12,
  "quotas": [
    {"family": "sprint", "min": 3, "minPerSex": 1, "maxPerSex": 4},
    {"family": "distance", "min": 3, "minPerSex": 1, "maxPerSex": 4},
    {"family": "jumps", "min": 3, "minPerSex": 1, "maxPerSex": 4},
    {"family": "throws", "min": 3, "minPerSex": 1, "maxPerSex": 4}
  ],
  "lineup": {"max": 8, "perFamily": 2, "bench": 4},
  "tablesDivisor": 10
}'::jsonb,
    updated_at = now();

update manager_leagues l
set rules = (select r.rules from manager_rules r)
            || jsonb_build_object('rounds', coalesce(l.rules -> 'rounds',
                                                     (select r.rules -> 'rounds' from manager_rules r)))
where l.mercato_opened_at is null;

update manager_leagues
set rules = private.manager_rules_four_families(rules)
where mercato_opened_at is not null;

-- As in #607; the quota of an athlete is the one of their Manager family, and the team holds
-- fewer than `maxPerSex` athletes of their sex in it (fitsQuotas, src/domain/manager-team.ts).
create or replace function private.manager_complement_candidates(p_league uuid, p_user uuid)
returns table (athlete_id uuid, price int)
language sql stable security definer set search_path = public as $$
  with league as (
    select rules, (rules ->> 'budget')::numeric::int as budget,
           (rules ->> 'minTeamSize')::int as min_size
    from manager_leagues where id = p_league
  ), team as (
    select t.sex, private.manager_family(t.family) as family
    from private.manager_team(p_league, p_user) t
  )
  select a.id, a.manager_price
  from league l
  cross join athletes a
  join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
  join disciplines d on d.name = ad.discipline
  where a.manager_price is not null and a.kind = 'athlete' and a.gender in ('F', 'M')
    and d.family <> 'relay'
    and not exists (select 1 from manager_awards w
                    where w.league_id = p_league and w.athlete_id = a.id)
    and a.manager_price <= l.budget - private.manager_spent(p_league, p_user)
    and (select count(*) from team) < l.min_size
    and exists (select 1 from jsonb_array_elements(l.rules -> 'quotas') q
                where q ->> 'family' = private.manager_family(d.family)
                  and (select count(*) from team t
                       where t.sex = a.gender::text and t.family = q ->> 'family')
                      < (q ->> 'maxPerSex')::numeric::int)
$$;

-- As in #425; a team is valid when, in every family of the quotas, it holds at least `min`
-- athletes and at least `minPerSex` of each sex (unmetQuotas, src/domain/manager-team.ts).
create or replace function private.check_manager_teams(p_league uuid) returns void
language sql security definer set search_path = public as $$
  update manager_members m
  set team_compliant = not exists (
    select 1
    from manager_leagues l
    cross join jsonb_array_elements(l.rules -> 'quotas') q
    cross join lateral (
      select count(*) as total,
             count(*) filter (where t.sex = 'F') as women,
             count(*) filter (where t.sex = 'M') as men
      from private.manager_team(p_league, m.user_id) t
      where private.manager_family(t.family) = q ->> 'family'
    ) c
    where l.id = p_league
      and (c.total < (q ->> 'min')::numeric::int
           or least(c.women, c.men) < (q ->> 'minPerSex')::numeric::int))
  where m.league_id = p_league
$$;

-- As in #427; the stadium holds `lineup.perFamily` places for each of the four families, and no
-- free place. Same rule as lineupProblem in src/domain/manager-lineup.ts.
create or replace function private.manager_lineup_problem(
  p_league uuid, p_user uuid, p_competition uuid, p_chosen uuid[]
) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_per_family int := coalesce(
    (select (rules #>> '{lineup,perFamily}')::numeric::int from manager_leagues where id = p_league),
    0);
  v_fill int;
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
  if exists (select 1 from private.manager_team(p_league, p_user) t
             where t.athlete_id = any(p_chosen) and private.manager_family(t.family) is null) then
    return 'does_not_fit';
  end if;

  -- Per family: the athletes of the team entered, the athletes chosen.
  with team as (
    select private.manager_family(t.family) as family,
           private.manager_entered(p_competition, t.athlete_id) as entered,
           t.athlete_id = any(p_chosen) as chosen
    from private.manager_team(p_league, p_user) t
  ), per_family as (
    select (select count(*) from team t where t.family = f.family and t.entered) as entered,
           (select count(*) from team t where t.family = f.family and t.chosen) as chosen
    from unnest(array['sprint', 'distance', 'jumps', 'throws']) f(family)
  )
  select coalesce(sum(least(entered, v_per_family)), 0),
         coalesce(sum(greatest(0, chosen - v_per_family)), 0)
  into v_fill, v_overflow
  from per_family;

  if v_overflow > 0 then
    return 'does_not_fit';
  end if;
  -- Every place the team can fill is filled.
  if cardinality(p_chosen) < v_fill then
    return 'incomplete';
  end if;
  return null;
end $$;

drop function private.manager_card_group(text);

drop function private.manager_rules_four_families(jsonb);
