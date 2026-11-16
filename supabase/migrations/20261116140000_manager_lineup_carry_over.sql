-- French Track Manager: a forgotten lineup is carried over (#1034, decisions of the owner of
-- 16 Nov. 2026, #1017). The lineup is the player's only action: at the lock of a competition, a
-- participant without a lineup gets a copy of their last one (starters, bench, disciplines,
-- designated substitutes and thresholds), keeping only the athletes entered in the competition:
--   - an athlete counts in the same discipline if they are entered in it, else in the first one
--     they are entered in (manager_discipline_options), else they are left out;
--   - a starter left out gives their place to their designated substitute, else to the first
--     substitute of the bench of the same Manager family; a place nobody can fill stays empty;
--   - a threshold stays with its starter only in the same discipline, with the same substitute;
--     the bench closes ranks.
-- The last lineup is the one the player validated themselves for the competition of the league
-- that locked last before this one (a copy is not copied again: agent's decision, the copy of a
-- copy would only lose athletes). The copy says where it comes from (carried_from), for
-- « Mes points ». Without any validated lineup before: no row, 0 point, as before.
-- pg_cron runs the carry-over every minute; it is made once per league and competition
-- (manager_lineup_carry_overs) and never overwrites a validated lineup.

alter table manager_lineups
  add column carried_from uuid references competitions(id) on delete set null;

-- The (league, competition) pairs whose lineups have been carried over.
create table manager_lineup_carry_overs (
  league_id      uuid not null references manager_leagues(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  done_at        timestamptz not null default now(),
  primary key (league_id, competition_id)
);
alter table manager_lineup_carry_overs enable row level security;
revoke all on manager_lineup_carry_overs from anon, authenticated;

-- The competitions locked already are left as they are: a lineup forgotten before this migration
-- scores 0, as the rules said then.
insert into manager_lineup_carry_overs (league_id, competition_id)
select l.id, c.id
from manager_leagues l
cross join lateral unnest(l.competition_ids) as e(id)
join competitions c on c.id = e.id
where now() >= private.manager_lineup_lock(c.id)
on conflict do nothing;

-- The lock lets the carry-over write (and only it: the flag is set inside
-- manager_carry_over_lineups, and players cannot write in these tables themselves).
create or replace function private.enforce_manager_lineup_lock() returns trigger
language plpgsql set search_path = public as $$
begin
  if now() >= private.manager_lineup_lock(new.competition_id)
     and coalesce(current_setting('ftp.manager_carry_over', true), '') <> 'on' then
    raise exception 'lineup locked: the competition has started' using errcode = 'FT023';
  end if;
  return new;
end $$;

-- The rows of the player's sheet for p_from, with the discipline each athlete counts in at p_to
-- (null when they are left out) and their Manager family.
create function private.manager_carried_rows(
  p_league uuid, p_user uuid, p_from uuid, p_to uuid
) returns table (athlete_id uuid, role text, slot int, was text, discipline text, family text,
                 substitute_id uuid, threshold numeric)
language sql stable security definer set search_path = public as $$
  select e.athlete_id, e.role, e.slot, e.discipline,
         case when t.athlete_id is not null and private.manager_entered(p_to, e.athlete_id) then
           coalesce(
             (select o.discipline from private.manager_discipline_options(p_to, e.athlete_id) o
              where o.discipline = e.discipline),
             (select o.discipline from private.manager_discipline_options(p_to, e.athlete_id) o
              where o.rank = 1))
         end,
         private.manager_family(t.family), e.substitute_id, e.threshold
  from manager_lineup_entries e
  left join private.manager_team(p_league, p_user) t on t.athlete_id = e.athlete_id
  where e.league_id = p_league and e.competition_id = p_from and e.user_id = p_user
$$;
revoke execute on function private.manager_carried_rows(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

-- Copies the player's last validated lineup to p_competition when they have none; whether a
-- lineup was copied.
create function private.manager_carry_over_lineup(p_league uuid, p_competition uuid, p_user uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_from uuid;
  v_row record;
  v_in uuid;
  v_starters jsonb := '[]';
  v_taken uuid[] := '{}';
begin
  if exists (select 1 from manager_lineups
             where league_id = p_league and competition_id = p_competition
               and user_id = p_user) then
    return false;
  end if;
  select ml.competition_id into v_from
  from manager_lineups ml
  where ml.league_id = p_league and ml.user_id = p_user and ml.carried_from is null
    and ml.competition_id <> p_competition
    and private.manager_lineup_lock(ml.competition_id) < private.manager_lineup_lock(p_competition)
  order by private.manager_lineup_lock(ml.competition_id) desc
  limit 1;
  if v_from is null then
    return false;
  end if;

  -- The starters, place by place: the same athlete, else who comes in for them.
  for v_row in
    select * from private.manager_carried_rows(p_league, p_user, v_from, p_competition)
    where role = 'starter' order by slot
  loop
    if v_row.discipline is not null then
      v_starters := v_starters || jsonb_build_object(
        'athlete', v_row.athlete_id, 'slot', v_row.slot, 'discipline', v_row.discipline,
        'substitute', v_row.substitute_id,
        'threshold', case when v_row.discipline = v_row.was then v_row.threshold end);
      v_taken := v_taken || v_row.athlete_id;
      continue;
    end if;
    -- Their designated substitute, else the first one of the bench of the same family, those
    -- designated for a starter who stays last.
    select b.athlete_id into v_in
    from private.manager_carried_rows(p_league, p_user, v_from, p_competition) b
    where b.role = 'substitute' and b.discipline is not null
      and b.family is not distinct from v_row.family
      and not (b.athlete_id = any (v_taken))
    order by b.athlete_id is distinct from v_row.substitute_id,
             exists (select 1 from private.manager_carried_rows(p_league, p_user, v_from,
                                                                 p_competition) s
                     where s.role = 'starter' and s.discipline is not null
                       and s.substitute_id = b.athlete_id),
             b.slot
    limit 1;
    if v_in is not null then
      v_starters := v_starters || jsonb_build_object(
        'athlete', v_in, 'slot', v_row.slot,
        'discipline', (select b.discipline
                       from private.manager_carried_rows(p_league, p_user, v_from,
                                                         p_competition) b
                       where b.athlete_id = v_in));
      v_taken := v_taken || v_in;
    end if;
  end loop;

  perform set_config('ftp.manager_carry_over', 'on', true);
  insert into manager_lineups (league_id, competition_id, user_id, athlete_ids, carried_from)
  values (p_league, p_competition, p_user,
          array(select (x ->> 'athlete')::uuid from jsonb_array_elements(v_starters) x
                order by (x ->> 'slot')::int),
          v_from);
  insert into manager_lineup_entries
    (league_id, competition_id, user_id, athlete_id, role, slot, discipline, substitute_id,
     threshold)
  -- A designated substitute who came in or was left out designates nobody any more, and their
  -- threshold goes with them.
  select p_league, p_competition, p_user, (x ->> 'athlete')::uuid, 'starter',
         (x ->> 'slot')::int, x ->> 'discipline', d.substitute_id,
         case when d.substitute_id is not null then (x ->> 'threshold')::numeric end
  from jsonb_array_elements(v_starters) x
  cross join lateral (
    select (select b.athlete_id
            from private.manager_carried_rows(p_league, p_user, v_from, p_competition) b
            where b.role = 'substitute' and b.discipline is not null
              and b.athlete_id = (x ->> 'substitute')::uuid
              and not (b.athlete_id = any (v_taken))) as substitute_id
  ) d
  union all
  select p_league, p_competition, p_user, b.athlete_id, 'substitute',
         (row_number() over (order by b.slot))::int, b.discipline, null, null
  from private.manager_carried_rows(p_league, p_user, v_from, p_competition) b
  where b.role = 'substitute' and b.discipline is not null and not (b.athlete_id = any (v_taken));
  perform set_config('ftp.manager_carry_over', 'off', true);
  return true;
end $$;
revoke execute on function private.manager_carry_over_lineup(uuid, uuid, uuid)
  from public, anon, authenticated;

-- Carries over the forgotten lineups of every competition locked at p_now and not carried over
-- yet, in lock order; how many lineups were copied.
create function private.manager_carry_over_lineups(p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_pair record;
  v_copied int := 0;
begin
  for v_pair in
    select l.id as league_id, c.id as competition_id
    from manager_leagues l
    cross join lateral unnest(l.competition_ids) as e(id)
    join competitions c on c.id = e.id
    where l.mercato_closed_at is not null
      and p_now >= private.manager_lineup_lock(c.id)
      and not exists (select 1 from manager_lineup_carry_overs o
                      where o.league_id = l.id and o.competition_id = c.id)
    order by private.manager_lineup_lock(c.id)
  loop
    select v_copied + count(*) filter (where private.manager_carry_over_lineup(
             v_pair.league_id, v_pair.competition_id, m.user_id))
    into v_copied
    from manager_members m
    where m.league_id = v_pair.league_id;
    insert into manager_lineup_carry_overs (league_id, competition_id)
    values (v_pair.league_id, v_pair.competition_id);
  end loop;
  return v_copied;
end $$;
revoke execute on function private.manager_carry_over_lineups(timestamptz)
  from public, anon, authenticated;

select cron.schedule('manager-lineup-carry-over', '* * * * *',
                     'select private.manager_carry_over_lineups()');

-- As in #427, with where a carried-over lineup comes from (carried_from_name, null otherwise).
drop function my_manager_lineups(uuid);
create function my_manager_lineups(p_league uuid)
returns table (competition_id uuid, slug text, name text, starts_on date, lock_at timestamptz,
               entered uuid[], athlete_ids uuid[], validated_at timestamptz,
               carried_from_name text)
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
         ml.athlete_ids, ml.validated_at, f.name
  from manager_leagues l
  cross join lateral unnest(l.competition_ids) as e(id)
  join competitions c on c.id = e.id
  left join manager_lineups ml
    on ml.league_id = l.id and ml.competition_id = c.id and ml.user_id = auth.uid()
  left join competitions f on f.id = ml.carried_from
  where l.id = p_league
  order by c.starts_on, c.name;
end $$;
revoke execute on function my_manager_lineups(uuid) from public, anon;
grant execute on function my_manager_lineups(uuid) to authenticated;
