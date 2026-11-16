-- French Track Manager, the substitutions in the score (#1033, decisions of the owner of
-- 16 Nov. 2026, #1017). The scoring sheet of the admin now holds the match sheet of every
-- participant (#1032) instead of the starters alone: the score is computed from it by
-- managerCompetitionScore (src/domain/manager-score.ts): the discipline chosen for each athlete
-- only, the tactical substitutions, then the designated substitute or the first one of the bench
-- of the family for a starter without a mark.
--
-- lineup = null without a validated lineup, else
--   {"starters": [{athlete_id, family, discipline, substitute_id, threshold}]   (place order)
--    "bench":    [{athlete_id, family, discipline}]}                           (rank order)
-- family is the Manager family of the athlete in the team (their main discipline), or of the
-- discipline that counts when they are not in it. A starter of a lineup without a sheet row
-- counts in their first discipline (manager_discipline_options), without a substitute.

create or replace function private.manager_scoring_lineup(
  p_league uuid, p_competition uuid, p_user uuid
) returns jsonb
language sql stable security definer set search_path = public as $$
  with lineup as (
    select ml.athlete_ids from manager_lineups ml
    where ml.league_id = p_league and ml.competition_id = p_competition and ml.user_id = p_user
  ), team as (
    select * from private.manager_team(p_league, p_user)
  ), entries as (
    select * from manager_lineup_entries e
    where e.league_id = p_league and e.competition_id = p_competition and e.user_id = p_user
  ), starters as (
    select a.n, a.id as athlete_id,
           coalesce(e.discipline, o.discipline) as discipline, e.substitute_id, e.threshold
    from lineup l
    cross join lateral unnest(l.athlete_ids) with ordinality as a(id, n)
    left join entries e on e.athlete_id = a.id and e.role = 'starter'
    left join lateral (select d.discipline
                       from private.manager_discipline_options(p_competition, a.id) d
                       where d.rank = 1) o on true
  ), bench as (
    select e.slot as n, e.athlete_id, e.discipline from entries e where e.role = 'substitute'
  )
  select jsonb_build_object(
    'starters', coalesce((
      select jsonb_agg(jsonb_build_object(
               'athlete_id', s.athlete_id,
               'family', coalesce(private.manager_family(t.family), private.manager_family(d.family)),
               'discipline', s.discipline, 'substitute_id', s.substitute_id,
               'threshold', s.threshold) order by s.n)
      from starters s
      left join team t on t.athlete_id = s.athlete_id
      left join disciplines d on d.name = s.discipline), '[]'::jsonb),
    'bench', coalesce((
      select jsonb_agg(jsonb_build_object(
               'athlete_id', b.athlete_id,
               'family', coalesce(private.manager_family(t.family), private.manager_family(d.family)),
               'discipline', b.discipline) order by b.n)
      from bench b
      left join team t on t.athlete_id = b.athlete_id
      left join disciplines d on d.name = b.discipline), '[]'::jsonb))
  where exists (select 1 from lineup)
$$;
revoke execute on function private.manager_scoring_lineup(uuid, uuid, uuid)
  from public, anon, authenticated;

-- As in #1031, with the match sheet of each participant.
create or replace function admin_manager_scoring_sheet(p_competition text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'only an admin can score the Manager' using errcode = '42501';
  end if;
  select id into v_id from competitions where slug = p_competition;
  if v_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'competition_id', v_id,
    'lock_at', private.manager_lineup_lock(v_id),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'league_id', m.league_id, 'user_id', m.user_id,
               'bonuses', coalesce(l.rules -> 'bonuses', '{}'::jsonb),
               'tables_divisor', coalesce((l.rules ->> 'tablesDivisor')::numeric::int, 10),
               'lineup', private.manager_scoring_lineup(l.id, v_id, m.user_id))
             order by m.league_id, m.user_id)
      from manager_leagues l
      join manager_members m on m.league_id = l.id
      where v_id = any (l.competition_ids) and l.mercato_closed_at is not null), '[]'::jsonb),
    'performances', coalesce((
      select jsonb_agg(jsonb_build_object(
               'athlete_id', p.athlete_id, 'discipline', e.discipline, 'gender', e.gender,
               'unit', coalesce(d.unit, 'time'), 'round', e.round, 'status', p.status,
               'place', p.place, 'mark', p.mark, 'records', to_jsonb(p.records))
             order by p.event_id, p.athlete_id)
      from event_performances p
      join events e on e.id = p.event_id
      left join disciplines d on d.name = e.discipline
      where e.competition_id = v_id), '[]'::jsonb));
end $$;
