-- French Track Manager, v0.13 (#425): completing the teams at the close of the mercato. Once the
-- bids under way are resolved, an incomplete team receives free athletes of the catalogue at
-- random, at their reference price: an athlete fits a team while it has room (`teamSize`), their
-- price is within its credits left and their sex and family have a quota (`quotas`) not yet at its
-- maximum. Teams take one athlete each in turn (by user id), until none can take any more:
-- complete, credits spent, or no free athlete fits. The athletes given make a last round. Then
-- each team is valid (team_compliant) when it reaches the minimum of every quota, else it is
-- non-compliant. The draw uses random(): setseed() makes it the same again (tests).

-- Null until the close of the mercato.
alter table manager_members add column team_compliant boolean;

-- The athletes of a participant's team, by sex and family.
create function private.manager_team(p_league uuid, p_user uuid)
returns table (athlete_id uuid, sex text, family text)
language sql stable security definer set search_path = public as $$
  select a.id, a.gender::text, d.family
  from manager_awards w
  join athletes a on a.id = w.athlete_id
  join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
  join disciplines d on d.name = ad.discipline
  where w.league_id = p_league and w.user_id = p_user
$$;
revoke execute on function private.manager_team(uuid, uuid) from public, anon, authenticated;

-- The free athletes of the catalogue that fit a participant's team now, with their price.
create function private.manager_complement_candidates(p_league uuid, p_user uuid)
returns table (athlete_id uuid, price int)
language sql stable security definer set search_path = public as $$
  with league as (
    select rules, (rules ->> 'budget')::numeric::int as budget,
           (rules ->> 'teamSize')::int as team_size
    from manager_leagues where id = p_league
  ), team as (
    select * from private.manager_team(p_league, p_user)
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
    and (l.team_size is null or (select count(*) from team) < l.team_size)
    and exists (select 1 from jsonb_array_elements(l.rules -> 'quotas') q
                where q ->> 'sex' = a.gender::text and q ->> 'family' = d.family
                  and (select count(*) from team t
                       where t.sex = a.gender::text and t.family = d.family)
                      < (q ->> 'max')::int)
$$;
revoke execute on function private.manager_complement_candidates(uuid, uuid)
  from public, anon, authenticated;

-- Gives the incomplete teams of a league free athletes at random, one per team in turn. One
-- random() per pick over the candidates sorted by id, so that a seed gives the same draw. The
-- caller locks the participants.
create function private.complete_manager_teams(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_round int;
  v_user uuid;
  v_athlete uuid;
  v_price int;
  v_draw double precision;
  v_given boolean;
begin
  loop
    v_given := false;
    for v_user in
      select user_id from manager_members where league_id = p_league order by user_id
    loop
      v_draw := random();
      select c.athlete_id, c.price into v_athlete, v_price
      from (select athlete_id, price, row_number() over (order by athlete_id) as n,
                   count(*) over () as total
            from private.manager_complement_candidates(p_league, v_user)) c
      where c.n = 1 + floor(v_draw * c.total)::int;
      continue when not found;
      if v_round is null then
        v_round := coalesce((select max(round) from manager_rounds where league_id = p_league), 0)
                   + 1;
        insert into manager_rounds (league_id, round, ends_at) values (p_league, v_round, now());
      end if;
      insert into manager_awards (league_id, athlete_id, user_id, amount, round)
      values (p_league, v_athlete, v_user, v_price, v_round);
      v_given := true;
    end loop;
    exit when not v_given;
  end loop;
end $$;
revoke execute on function private.complete_manager_teams(uuid) from public, anon, authenticated;

-- Marks each team of a league valid when it reaches the minimum of every quota, else
-- non-compliant.
create function private.check_manager_teams(p_league uuid) returns void
language sql security definer set search_path = public as $$
  update manager_members m
  set team_compliant = not exists (
    select 1
    from manager_leagues l
    cross join jsonb_array_elements(l.rules -> 'quotas') q
    where l.id = p_league
      and (select count(*) from private.manager_team(p_league, m.user_id) t
           where t.sex = q ->> 'sex' and t.family = q ->> 'family') < (q ->> 'min')::int)
  where m.league_id = p_league
$$;
revoke execute on function private.check_manager_teams(uuid) from public, anon, authenticated;

-- As in #424; the incomplete teams are completed, then every team is checked, before the league
-- is closed.
create or replace function private.finish_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from manager_bids where league_id = p_league) then
    perform private.award_manager_round(p_league,
      (select round from private.manager_open_round(p_league)), now());
  end if;
  perform private.complete_manager_teams(p_league);
  perform private.check_manager_teams(p_league);
  update manager_leagues set mercato_closed_at = now() where id = p_league;
end $$;
