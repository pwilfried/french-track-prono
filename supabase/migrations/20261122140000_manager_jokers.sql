-- Manager jokers (#1091, decision of the owner, 22 Nov 2026): same idea as the league jokers of
-- the predictions (#1090). A Manager league gets the active jokers of the catalogue (game
-- `manager`) when it is created; each player plays each one once in the season, at most one per
-- head-to-head, chosen with the lineup and changed until its lock; the opponent sees it at the
-- reveal, with the team. Never on a bonus matchday (no head-to-head).
--
-- What each joker does to the score of the matchday is computed in TypeScript
-- (src/domain/manager-jokers.ts) from the scoring sheet below, and stored with the score:
-- `manager_scores.jokers` (what the jokers of both sides added or took) and `joker_effects`.
--
-- Error codes: 42501 not signed in or not a participant; FT023 the lineup is locked (as for the
-- lineup); FT045 the joker is not in the player's hand (not in the league, or played on another
-- matchday); FT048 no head-to-head for the player on this competition (bonus matchday, no
-- schedule); FT049 « Avantage terrain » away from home; FT050 a target that does not fit the
-- joker; FT051 coaching not possible (not played on this matchday, already used, before the lock,
-- or an event already started).

-- ---------------------------------------------------------------------------------------------
-- The catalogue.

insert into jokers (game, kind, position) values
  ('manager', 'captain', 1),
  ('manager', 'false_start', 2),
  ('manager', 'extended_bench', 3),
  ('manager', 'coaching', 4),
  ('manager', 'home_advantage', 5);

-- ---------------------------------------------------------------------------------------------
-- The jokers of each Manager league: every active joker of the game when it is created.

create table manager_league_jokers (
  league_id uuid not null references manager_leagues(id) on delete cascade,
  kind      text not null,
  primary key (league_id, kind)
);

alter table manager_league_jokers enable row level security;
revoke insert, update, delete, truncate on manager_league_jokers from anon, authenticated;
create policy members_read on manager_league_jokers for select to authenticated
  using (is_manager_member(league_id) or is_admin());

create function private.give_manager_league_jokers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into manager_league_jokers (league_id, kind)
  select new.id, j.kind from jokers j where j.game = 'manager' and j.active;
  return new;
end $$;
create trigger trg_give_manager_league_jokers after insert on manager_leagues
  for each row execute function private.give_manager_league_jokers();

insert into manager_league_jokers (league_id, kind)
select l.id, j.kind from manager_leagues l cross join jokers j where j.game = 'manager' and j.active;

-- ---------------------------------------------------------------------------------------------
-- The jokers played: by (league, player, matchday's competition). Once in the season (the
-- primary key), one per head-to-head (the unique constraint).
--   athlete_id: the captain, the athlete of the opponent hit by the false start, the 9th starter,
--               the athlete coached in (null until the coaching is used).
--   discipline: where the 9th starter or the coached athlete counts.
--   replaced_id: the starter the coaching takes out.

create table manager_joker_plays (
  league_id      uuid not null,
  user_id        uuid not null,
  competition_id uuid not null references competitions(id) on delete cascade,
  kind           text not null,
  athlete_id     uuid references athletes(id) on delete set null,
  discipline     text references disciplines(name) on update cascade,
  replaced_id    uuid references athletes(id) on delete set null,
  played_at      timestamptz not null default now(),
  coached_at     timestamptz,
  primary key (league_id, user_id, kind),
  unique (league_id, user_id, competition_id),
  foreign key (league_id, user_id) references manager_members(league_id, user_id) on delete cascade,
  foreign key (league_id, kind) references manager_league_jokers(league_id, kind) on delete cascade,
  check (kind <> 'home_advantage' or (athlete_id is null and discipline is null)),
  check (kind in ('extended_bench', 'coaching') or discipline is null),
  check (kind = 'coaching' or (replaced_id is null and coached_at is null))
);
create index on manager_joker_plays (competition_id);

alter table manager_joker_plays enable row level security;
revoke insert, update, delete, truncate on manager_joker_plays from anon, authenticated;
-- Whether the lineups of a competition are locked: read by the policy below.
create function private.manager_locked(p_competition uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.manager_lineup_lock(p_competition) <= now()
$$;
revoke execute on function private.manager_locked(uuid) from public, anon;
grant execute on function private.manager_locked(uuid) to authenticated;

-- A player sees their own jokers; the other participants see them from the lock (the reveal).
create policy read_own_or_locked on manager_joker_plays for select to authenticated
  using (user_id = auth.uid()
         or (is_manager_member(league_id) and private.manager_locked(competition_id))
         or is_admin());

-- The head-to-head of a player on a competition: their side and their opponent, or nothing on a
-- bonus matchday or without a schedule.
create function private.manager_duel_side(p_league uuid, p_competition uuid, p_user uuid)
returns table (home boolean, opponent_id uuid)
language sql stable security definer set search_path = public as $$
  select f.home_id = p_user, case when f.home_id = p_user then f.away_id else f.home_id end
  from manager_matchdays md
  join manager_fixtures f on f.league_id = md.league_id and f.round = md.round
  where md.league_id = p_league and md.competition_id = p_competition and not md.bonus
    and p_user in (f.home_id, f.away_id)
$$;
revoke execute on function private.manager_duel_side(uuid, uuid, uuid)
  from public, anon, authenticated;

-- The head-to-head of the signed-in player on a competition, for the jokers: home or away, the
-- opponent and the athletes of their team (names only: what they paid stays secret), the targets
-- of « Faux départ ». Null on a bonus matchday or without a schedule.
create function manager_joker_duel(p_league uuid, p_competition uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_home boolean;
  v_opponent uuid;
begin
  if auth.uid() is null or not is_manager_member(p_league) then
    raise exception 'not a participant of this league' using errcode = '42501';
  end if;
  select d.home, d.opponent_id into v_home, v_opponent
  from private.manager_duel_side(p_league, p_competition, auth.uid()) d;
  if v_opponent is null then
    return null;
  end if;
  return jsonb_build_object(
    'home', v_home, 'opponent_id', v_opponent,
    'opponent_team', coalesce((
      select jsonb_agg(jsonb_build_object('athlete_id', a.id, 'name', a.name) order by a.name)
      from private.manager_team(p_league, v_opponent) t
      join athletes a on a.id = t.athlete_id), '[]'::jsonb));
end $$;
revoke execute on function manager_joker_duel(uuid, uuid) from public, anon;
grant execute on function manager_joker_duel(uuid, uuid) to authenticated;

-- Whether an athlete is on the match sheet of a player (starter or substitute).
create function private.manager_on_sheet(p_league uuid, p_competition uuid, p_user uuid,
                                         p_athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from manager_lineups l
                 where l.league_id = p_league and l.competition_id = p_competition
                   and l.user_id = p_user and p_athlete = any (l.athlete_ids))
      or exists (select 1 from manager_lineup_entries e
                 where e.league_id = p_league and e.competition_id = p_competition
                   and e.user_id = p_user and e.athlete_id = p_athlete)
$$;
revoke execute on function private.manager_on_sheet(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

-- When an athlete's event starts in the competition: the first one they are entered in for the
-- discipline, else the first one of the discipline; null without any.
create function private.manager_athlete_start(p_competition uuid, p_athlete uuid,
                                              p_discipline text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select min(ev.starts_at) from entries en join events ev on ev.id = en.event_id
     where ev.competition_id = p_competition and en.athlete_id = p_athlete
       and ev.discipline = p_discipline),
    (select min(ev.starts_at) from events ev
     where ev.competition_id = p_competition and ev.discipline = p_discipline))
$$;
revoke execute on function private.manager_athlete_start(uuid, uuid, text)
  from public, anon, authenticated;

-- Plays a joker of the league on the signed-in player's head-to-head of the competition, before
-- the lock of the lineup; a joker already on the matchday is replaced. The target:
--   captain: an athlete of the player's team; false_start: an athlete of the opponent's team;
--   extended_bench: an athlete of the player's team not on the match sheet, with a discipline
--   they can count in (p_discipline, else their first one); coaching, home_advantage: none.
create function play_manager_joker(p_league uuid, p_competition uuid, p_kind text,
                                   p_athlete uuid default null, p_discipline text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_home boolean;
  v_opponent uuid;
  v_discipline text;
begin
  if v_uid is null or not is_manager_member(p_league) then
    raise exception 'not a participant of this league' using errcode = '42501';
  end if;
  if now() >= private.manager_lineup_lock(p_competition) then
    raise exception 'lineup locked: the competition has started' using errcode = 'FT023';
  end if;
  if not exists (select 1 from manager_league_jokers where league_id = p_league and kind = p_kind)
     or exists (select 1 from manager_joker_plays
                where league_id = p_league and user_id = v_uid and kind = p_kind
                  and competition_id <> p_competition) then
    raise exception 'this joker is not in the hand' using errcode = 'FT045';
  end if;
  select d.home, d.opponent_id into v_home, v_opponent
  from private.manager_duel_side(p_league, p_competition, v_uid) d;
  if v_opponent is null then
    raise exception 'no head-to-head on this competition' using errcode = 'FT048';
  end if;
  if p_kind = 'home_advantage' and not v_home then
    raise exception 'the home advantage is played at home' using errcode = 'FT049';
  end if;

  if p_kind in ('coaching', 'home_advantage') then
    if p_athlete is not null or p_discipline is not null then
      raise exception 'this joker has no target' using errcode = 'FT050';
    end if;
  elsif p_athlete is null
     or (p_kind = 'false_start'
         and not exists (select 1 from private.manager_team(p_league, v_opponent) t
                         where t.athlete_id = p_athlete))
     or (p_kind in ('captain', 'extended_bench')
         and not exists (select 1 from private.manager_team(p_league, v_uid) t
                         where t.athlete_id = p_athlete))
     or (p_kind = 'extended_bench'
         and private.manager_on_sheet(p_league, p_competition, v_uid, p_athlete)) then
    raise exception 'this target does not fit the joker' using errcode = 'FT050';
  elsif p_kind <> 'extended_bench' and p_discipline is not null then
    raise exception 'this joker has no discipline' using errcode = 'FT050';
  end if;
  if p_kind = 'extended_bench' then
    select o.discipline into v_discipline
    from private.manager_discipline_options(p_competition, p_athlete) o
    where o.discipline = coalesce(p_discipline, o.discipline)
    order by o.rank limit 1;
    if v_discipline is null then
      raise exception 'the athlete cannot count in this discipline' using errcode = 'FT050';
    end if;
  end if;

  delete from manager_joker_plays
  where league_id = p_league and user_id = v_uid and competition_id = p_competition;
  insert into manager_joker_plays (league_id, user_id, competition_id, kind, athlete_id, discipline)
  values (p_league, v_uid, p_competition, p_kind, p_athlete, v_discipline);
end $$;
revoke execute on function play_manager_joker(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function play_manager_joker(uuid, uuid, text, uuid, text) to authenticated;

-- Takes back the joker of the matchday, before the lock.
create function remove_manager_joker(p_league uuid, p_competition uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_manager_member(p_league) then
    raise exception 'not a participant of this league' using errcode = '42501';
  end if;
  if now() >= private.manager_lineup_lock(p_competition) then
    raise exception 'lineup locked: the competition has started' using errcode = 'FT023';
  end if;
  delete from manager_joker_plays
  where league_id = p_league and user_id = auth.uid() and competition_id = p_competition;
end $$;
revoke execute on function remove_manager_joker(uuid, uuid) from public, anon;
grant execute on function remove_manager_joker(uuid, uuid) to authenticated;

-- « Coaching », after the lock: the player puts an athlete of their team who is not on the match
-- sheet in the place of a starter of the same family whose event has not started, once, in a
-- discipline the athlete can count in (p_discipline, else their first one) whose event has not
-- started either.
create function coach_manager_lineup(p_league uuid, p_competition uuid, p_out uuid, p_in uuid,
                                     p_discipline text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_out_family text;
  v_out_discipline text;
  v_in_family text;
  v_discipline text;
begin
  if v_uid is null or not is_manager_member(p_league) then
    raise exception 'not a participant of this league' using errcode = '42501';
  end if;
  if now() < private.manager_lineup_lock(p_competition)
     or not exists (select 1 from manager_joker_plays
                    where league_id = p_league and user_id = v_uid
                      and competition_id = p_competition and kind = 'coaching'
                      and coached_at is null) then
    raise exception 'no coaching to use on this matchday' using errcode = 'FT051';
  end if;
  select private.manager_family(t.family) into v_out_family
  from private.manager_team(p_league, v_uid) t
  join manager_lineups l on l.league_id = p_league and l.competition_id = p_competition
                        and l.user_id = v_uid and t.athlete_id = any (l.athlete_ids)
  where t.athlete_id = p_out;
  select private.manager_family(t.family) into v_in_family
  from private.manager_team(p_league, v_uid) t where t.athlete_id = p_in;
  if v_out_family is null or v_in_family is distinct from v_out_family
     or private.manager_on_sheet(p_league, p_competition, v_uid, p_in) then
    raise exception 'this change does not fit the coaching' using errcode = 'FT050';
  end if;
  select coalesce(
    (select e.discipline from manager_lineup_entries e
     where e.league_id = p_league and e.competition_id = p_competition and e.user_id = v_uid
       and e.athlete_id = p_out and e.role = 'starter'),
    (select o.discipline from private.manager_discipline_options(p_competition, p_out) o
     where o.rank = 1)) into v_out_discipline;
  select o.discipline into v_discipline
  from private.manager_discipline_options(p_competition, p_in) o
  where o.discipline = coalesce(p_discipline, o.discipline)
  order by o.rank limit 1;
  if v_discipline is null then
    raise exception 'the athlete cannot count in this discipline' using errcode = 'FT050';
  end if;
  if private.manager_athlete_start(p_competition, p_out, v_out_discipline) <= now()
     or private.manager_athlete_start(p_competition, p_in, v_discipline) <= now() then
    raise exception 'the event has started' using errcode = 'FT051';
  end if;
  update manager_joker_plays
  set athlete_id = p_in, discipline = v_discipline, replaced_id = p_out, coached_at = now()
  where league_id = p_league and user_id = v_uid and competition_id = p_competition
    and kind = 'coaching';
end $$;
revoke execute on function coach_manager_lineup(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function coach_manager_lineup(uuid, uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The scores keep what the jokers changed.

do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'manager_scores'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%(hungarian + bonus) + predictions%';
  execute format('alter table manager_scores drop constraint %I', v_name);
end $$;
alter table manager_scores
  add column jokers int not null default 0,
  -- [{kind, by: me | opponent, athlete_id, points}] (src/domain/manager-jokers.ts).
  add column joker_effects jsonb not null default '[]'
    check (jsonb_typeof(joker_effects) = 'array'),
  add constraint manager_scores_total_check
    check (total = hungarian + bonus + predictions + jokers);

-- As in #1026 (20261116180000), with the joker of each participant and the head-to-heads.
--   joker = null, or {kind, athlete_id, family, discipline, replaced_id}; family: of the athlete
--   in the team, or of the discipline, as for the match sheet.
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
               'lineup', private.manager_scoring_lineup(l.id, v_id, m.user_id),
               'joker', (
                 select jsonb_build_object(
                          'kind', jp.kind, 'athlete_id', jp.athlete_id,
                          'family', coalesce(private.manager_family(t.family),
                                             private.manager_family(d.family)),
                          'discipline', jp.discipline, 'replaced_id', jp.replaced_id)
                 from manager_joker_plays jp
                 left join private.manager_team(l.id, m.user_id) t on t.athlete_id = jp.athlete_id
                 left join disciplines d on d.name = jp.discipline
                 where jp.league_id = l.id and jp.user_id = m.user_id
                   and jp.competition_id = v_id))
             order by m.league_id, m.user_id)
      from manager_leagues l
      join manager_members m on m.league_id = l.id
      where v_id = any (l.competition_ids) and l.mercato_closed_at is not null), '[]'::jsonb),
    'duels', coalesce((
      select jsonb_agg(jsonb_build_object('league_id', f.league_id, 'home_id', f.home_id,
                                          'away_id', f.away_id)
                       order by f.league_id, f.home_id)
      from manager_matchdays md
      join manager_fixtures f on f.league_id = md.league_id and f.round = md.round
      where md.competition_id = v_id and not md.bonus), '[]'::jsonb),
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

-- As in #1031 (20261116120000), with what the jokers changed.
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
                              bonus, predictions, jokers, joker_effects, athletes, complete)
  select (l ->> 'league_id')::uuid, p_competition, (l ->> 'user_id')::uuid,
         (l ->> 'lined_up')::boolean, (l ->> 'total')::int, (l ->> 'hungarian')::int,
         (l ->> 'bonus')::int, 0, coalesce((l ->> 'jokers')::int, 0),
         coalesce(l -> 'joker_effects', '[]'::jsonb), coalesce(l -> 'athletes', '[]'::jsonb),
         v_complete
  from jsonb_array_elements(p_lines) as l;
  perform private.log_admin_action('run_manager_scoring', null, p_lines);
end $$;

-- As in #431, with the jokers.
drop function my_manager_score(uuid, uuid);
create function my_manager_score(p_league uuid, p_competition uuid)
returns table (lined_up boolean, total int, hungarian int, bonus int, predictions int,
               athletes jsonb, computed_at timestamptz, jokers int, joker_effects jsonb)
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
         s.computed_at, s.jokers,
         coalesce((select jsonb_agg(o.e || jsonb_build_object('name', a.name) order by o.n)
                   from jsonb_array_elements(s.joker_effects) with ordinality as o(e, n)
                   left join athletes a on a.id = (o.e ->> 'athlete_id')::uuid), '[]'::jsonb)
  from manager_scores s
  where s.league_id = p_league and s.competition_id = p_competition and s.user_id = auth.uid();
end $$;
revoke execute on function my_manager_score(uuid, uuid) from public, anon;
grant execute on function my_manager_score(uuid, uuid) to authenticated;
