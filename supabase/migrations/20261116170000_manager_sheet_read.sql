-- French Track Manager, reading the match sheet (#1035). The lineup screen shows, for every
-- athlete of the player's team, the disciplines they may count in for the competition (the
-- first one first, as manager_discipline_options) and where the saved sheet puts them: starter
-- (place order), substitute (rank), or nothing (the reserve), with the discipline, the
-- designated substitute and the threshold.
-- Error codes: 42501 not a participant, P0002 not an eligible competition of the league.

create function my_manager_sheet(p_league uuid, p_competition uuid)
returns table (athlete_id uuid, disciplines jsonb, role text, slot int, discipline text,
               substitute_id uuid, threshold numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant reads their match sheet' using errcode = '42501';
  end if;
  if not exists (select 1 from manager_leagues
                 where id = p_league and p_competition = any(competition_ids)) then
    raise exception 'not an eligible competition of the league' using errcode = 'P0002';
  end if;
  return query
  select w.athlete_id,
         coalesce((select jsonb_agg(jsonb_build_object('name', o.discipline, 'family', o.family,
                                                       'unit', o.unit) order by o.rank)
                   from private.manager_discipline_options(p_competition, w.athlete_id) o),
                  '[]'::jsonb),
         e.role, e.slot, e.discipline, e.substitute_id, e.threshold
  from manager_awards w
  left join manager_lineup_entries e
    on e.league_id = p_league and e.competition_id = p_competition
   and e.user_id = auth.uid() and e.athlete_id = w.athlete_id
  where w.league_id = p_league and w.user_id = auth.uid()
  order by w.athlete_id;
end $$;
revoke execute on function my_manager_sheet(uuid, uuid) from public, anon;
grant execute on function my_manager_sheet(uuid, uuid) to authenticated;
