-- French Track Manager, v0.15 (#431): the score of a participant for a competition = World
-- Athletics points of every lined-up athlete + their sporting bonuses + the participant's
-- prediction points on the competition. Without a lineup, 0 for the whole competition.
-- The World Athletics tables live in TypeScript (src/domain/world-athletics-tables.ts): the admin's
-- session reads the sheet below, src/domain/manager-score.ts computes, and the scores of the
-- competition are written back in one go. Running it again replaces them (#416: a corrected
-- result is computed again).
-- Error codes: 42501 not an admin (or not a participant for my_manager_score), 23514 a score whose
-- parts do not add up.

create table manager_scores (
  league_id      uuid not null,
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id        uuid not null,
  lined_up       boolean not null,
  total          int not null,
  hungarian      int not null check (hungarian >= 0),
  bonus          int not null check (bonus >= 0),
  predictions    int not null,
  -- [{athlete_id, discipline, mark, status, points, bonuses, bonus_points, total}], strongest first.
  athletes       jsonb not null default '[]' check (jsonb_typeof(athletes) = 'array'),
  computed_at    timestamptz not null default now(),
  primary key (league_id, competition_id, user_id),
  foreign key (league_id, user_id) references manager_members (league_id, user_id) on delete cascade,
  check (total = hungarian + bonus + predictions),
  check (lined_up or (total = 0 and hungarian = 0 and bonus = 0 and predictions = 0
                      and athletes = '[]'::jsonb))
);

-- The participants of a league read its scores (the lineups are locked by then); only the RPC
-- below writes them.
alter table manager_scores enable row level security;
create policy read_member on manager_scores for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_scores from anon, authenticated;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player', 'create_discipline', 'moderate_club', 'set_manager_rules',
                    'set_performances', 'run_manager_scoring'));

-- Everything needed to score a competition (by slug), or null when it does not exist: when the
-- lineups lock; every participant of a Manager league playing it (mercato closed), with the bonus
-- values of the league and their lineup (null without one); every performance entered in its
-- events, with the discipline, sex, unit and round; the prediction points of every player on it.
-- Lineups are private: admin only. 42501 not an admin.
create function admin_manager_scoring_sheet(p_competition text) returns jsonb
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
      where e.competition_id = v_id), '[]'::jsonb),
    'predictions', coalesce((
      select jsonb_object_agg(s.user_id, s.points)
      from (select user_id, sum(points)::int as points from score_events
            where competition_id = v_id group by user_id) s), '{}'::jsonb));
end $$;
revoke execute on function admin_manager_scoring_sheet(text) from public, anon;
grant execute on function admin_manager_scoring_sheet(text) to authenticated;

-- Replaces every Manager score of a competition in one transaction, and logs it. Lines:
-- [{league_id, user_id, lined_up, total, hungarian, bonus, predictions, athletes}].
create function admin_set_manager_scores(p_competition uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can score the Manager' using errcode = '42501';
  end if;
  delete from manager_scores where competition_id = p_competition;
  insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian,
                              bonus, predictions, athletes)
  select (l ->> 'league_id')::uuid, p_competition, (l ->> 'user_id')::uuid,
         (l ->> 'lined_up')::boolean, (l ->> 'total')::int, (l ->> 'hungarian')::int,
         (l ->> 'bonus')::int, (l ->> 'predictions')::int, coalesce(l -> 'athletes', '[]'::jsonb)
  from jsonb_array_elements(p_lines) as l;
  perform private.log_admin_action('run_manager_scoring', null, p_lines);
end $$;
revoke execute on function admin_set_manager_scores(uuid, jsonb) from public, anon;
grant execute on function admin_set_manager_scores(uuid, jsonb) to authenticated;

-- The signed-in participant's score for a competition of the league, the athletes with their
-- names, in the stored order; no row before the first computation. 42501 not a participant.
create function my_manager_score(p_league uuid, p_competition uuid)
returns table (lined_up boolean, total int, hungarian int, bonus int, predictions int,
               athletes jsonb, computed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant reads their points' using errcode = '42501';
  end if;
  return query
  select s.lined_up, s.total, s.hungarian, s.bonus, s.predictions,
         coalesce((select jsonb_agg(o.a || jsonb_build_object('name', coalesce(a.name, '?'))
                                    order by o.n)
                   from jsonb_array_elements(s.athletes) with ordinality as o(a, n)
                   left join athletes a on a.id = (o.a ->> 'athlete_id')::uuid), '[]'::jsonb),
         s.computed_at
  from manager_scores s
  where s.league_id = p_league and s.competition_id = p_competition and s.user_id = auth.uid();
end $$;
revoke execute on function my_manager_score(uuid, uuid) from public, anon;
grant execute on function my_manager_score(uuid, uuid) to authenticated;
