-- French Track Manager (#1031, decisions of the owner of 16 Nov. 2026, #1017): the score of a
-- competition = for every lined-up athlete, their World Athletics points divided by the league's
-- `tablesDivisor` (rounded down, athlete by athlete) + their sporting bonuses. The predictions no
-- longer count: the column `predictions` stays, always 0. Same rule as
-- src/domain/manager-score.ts (managerTablePoints, managerCompetitionScore).

alter table manager_scores alter column predictions set default 0;

-- As in #431, with the divisor of each league (10 when its rules predate it) and without the
-- prediction points.
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
               'lineup', to_jsonb(ml.athlete_ids))
             order by m.league_id, m.user_id)
      from manager_leagues l
      join manager_members m on m.league_id = l.id
      left join manager_lineups ml
        on ml.league_id = l.id and ml.competition_id = v_id and ml.user_id = m.user_id
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

-- As in #665; lines: [{league_id, user_id, lined_up, total, hungarian, bonus, athletes}], the
-- prediction part is always 0.
create or replace function admin_set_manager_scores(p_competition uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_complete boolean := private.competition_complete(p_competition);
begin
  if not is_admin() then
    raise exception 'only an admin can score the Manager' using errcode = '42501';
  end if;
  delete from manager_scores where competition_id = p_competition;
  insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                              bonus, predictions, athletes, complete)
  select (l ->> 'league_id')::uuid, p_competition, (l ->> 'user_id')::uuid,
         (l ->> 'lined_up')::boolean, (l ->> 'total')::int, (l ->> 'hungarian')::int,
         (l ->> 'bonus')::int, 0, coalesce(l -> 'athletes', '[]'::jsonb), v_complete
  from jsonb_array_elements(p_lines) as l;
  perform private.log_admin_action('run_manager_scoring', null, p_lines);
end $$;

-- « Recalculer les points Manager » for the scores already stored: the stored `points` of each
-- athlete are the raw tables; they are divided by the league's divisor, the athletes listed again
-- from the strongest, the predictions set to 0. Bonuses do not change.
update manager_scores s
set athletes = r.athletes, hungarian = r.hungarian, total = r.hungarian + s.bonus, predictions = 0
from (
  select s2.league_id, s2.competition_id, s2.user_id,
         coalesce(sum(a.points), 0)::int as hungarian,
         coalesce(jsonb_agg(a.athlete order by a.total desc, a.n)
                    filter (where a.athlete is not null), '[]'::jsonb) as athletes
  from manager_scores s2
  join manager_leagues l on l.id = s2.league_id
  left join lateral (
    select o.n, d.points, d.points + coalesce((o.a ->> 'bonus_points')::int, 0) as total,
           o.a || jsonb_build_object(
             'points', d.points,
             'total', d.points + coalesce((o.a ->> 'bonus_points')::int, 0)) as athlete
    from jsonb_array_elements(s2.athletes) with ordinality as o(a, n)
    cross join lateral (
      select floor(coalesce((o.a ->> 'points')::numeric, 0)
                   / coalesce((l.rules ->> 'tablesDivisor')::numeric::int, 10))::int as points
    ) d
  ) a on true
  group by s2.league_id, s2.competition_id, s2.user_id
) r
where r.league_id = s.league_id and r.competition_id = s.competition_id and r.user_id = s.user_id;
