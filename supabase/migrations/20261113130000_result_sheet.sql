-- One results sheet per event (#665, owner's decision of 13 Nov. 2026). The admin enters an event
-- once: the performances sheet (#429) becomes the result entry, and the official podium of the
-- predictions (`results`) is drawn from it: the finishers placed 1 to 3, tied athletes sharing their
-- step (same rule as podiumFromPerformances in src/domain/performance.ts). The app then scores the
-- predictions and the Manager at once. Without a Manager league on the competition the podium is
-- enough: a placed finisher may have no mark (it scores 0 in the Manager).
-- Manager scores are computed after every sheet, so a competition is scored event after event: a
-- head-to-head only counts once every event of the competition has its result (`complete`), and a
-- season only ends then.

-- A finisher has a place or a mark; an athlete who did not finish has nothing but the status.
alter table event_performances drop constraint event_performances_check;
alter table event_performances add constraint event_performances_check
  check (case when status = 'ok' then place is not null or (mark is not null and btrim(mark) <> '')
              else place is null and mark is null and records = '{}' end);

-- Replaces every performance of an event and its official podium in one transaction, and logs it.
-- Lines: [{athlete_id, status, place, mark, records}]. 42501 not an admin; 23503 an athlete is not
-- on the start list (foreign key); 23514 a line breaks the rules above.
create or replace function admin_set_performances(p_event uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can enter performances' using errcode = '42501';
  end if;
  delete from event_performances where event_id = p_event;
  insert into event_performances (event_id, athlete_id, status, place, mark, records)
  select p_event, (l ->> 'athlete_id')::uuid, coalesce(l ->> 'status', 'ok'),
         (l ->> 'place')::int, nullif(btrim(l ->> 'mark'), ''),
         array(select jsonb_array_elements_text(coalesce(l -> 'records', '[]'::jsonb)))
  from jsonb_array_elements(p_lines) as l;
  -- The podium of the predictions, drawn from the sheet.
  delete from results where event_id = p_event;
  insert into results (event_id, athlete_id, rank, mark)
  select event_id, athlete_id, place, mark
  from event_performances
  where event_id = p_event and status = 'ok' and place between 1 and 3;
  perform private.log_admin_action('set_performances', p_event, p_lines);
end $$;

-- Whether every event of a competition has its official result.
create function private.competition_complete(p_competition uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from events e
                     where e.competition_id = p_competition
                       and not exists (select 1 from results r where r.event_id = e.id))
$$;
revoke execute on function private.competition_complete(uuid) from public, anon, authenticated;

-- Scores computed before every event had its result are provisional: the head-to-head is shown,
-- it does not count in the standings yet. Scores stored before this change were complete.
alter table manager_scores add column complete boolean not null default true;

-- Replaces every Manager score of a competition in one transaction, and logs it. Lines:
-- [{league_id, user_id, lined_up, total, hungarian, bonus, predictions, athletes}]. Whether they
-- are complete is the database's call, not the client's.
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
         (l ->> 'bonus')::int, (l ->> 'predictions')::int, coalesce(l -> 'athletes', '[]'::jsonb),
         v_complete
  from jsonb_array_elements(p_lines) as l;
  perform private.log_admin_action('run_manager_scoring', null, p_lines);
end $$;

-- A season only ends once the scores of every competition of its league are complete.
create or replace function private.close_seasons_on_scores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.close_manager_season(l.league_id)
  from (select distinct league_id from added) l
  where not exists (select 1 from manager_scores s
                    where s.league_id = l.league_id and not s.complete);
  return null;
end $$;
