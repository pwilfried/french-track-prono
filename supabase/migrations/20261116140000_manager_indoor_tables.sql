-- French Track Manager (#1026, decision of the owner of 16 Nov. 2026): an indoor competition
-- (`venue = 'indoor'`) scores its races with the World Athletics short-track tables. The scoring
-- sheet tells the venue; the points are computed by src/domain/world-athletics-points.ts.

-- As in #1031, with `indoor`.
create or replace function admin_manager_scoring_sheet(p_competition text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
  v_venue text;
begin
  if not is_admin() then
    raise exception 'only an admin can score the Manager' using errcode = '42501';
  end if;
  select id, venue into v_id, v_venue from competitions where slug = p_competition;
  if v_id is null then
    return null;
  end if;
  return jsonb_build_object(
    'competition_id', v_id,
    'lock_at', private.manager_lineup_lock(v_id),
    'indoor', v_venue = 'indoor',
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
