-- French Track Manager (#607): a team has no maximum size any more, only a minimum set by the
-- admin (`minTeamSize`). A participant recruits as long as their credits left pay the cheapest
-- athlete still free; the complement at the close of the mercato fills a team up to the minimum
-- only (quotas and credits still apply). The same rules are in src/domain/manager-mercato.ts and
-- src/domain/manager-rules.ts.

-- The leagues already created keep their rules: their `teamSize` becomes their minimum.
update manager_rules
set rules = (rules - 'teamSize') || jsonb_build_object('minTeamSize', rules -> 'teamSize')
where rules ? 'teamSize';
update manager_leagues
set rules = (rules - 'teamSize') || jsonb_build_object('minTeamSize', rules -> 'teamSize')
where rules ? 'teamSize';

-- As in #424, without the room in the team: the participants whose credits left pay the cheapest
-- athlete of the catalogue still free in the league. The bids under way do not count: they are
-- resolved before any close.
create or replace function private.manager_recruiters(p_league uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with league as (
    select (rules ->> 'budget')::numeric::int as budget
    from manager_leagues where id = p_league
  ), cheapest as (
    select min(a.manager_price) as price
    from athletes a
    join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
    join disciplines d on d.name = ad.discipline
    where a.manager_price is not null and a.kind = 'athlete' and a.gender in ('F', 'M')
      and d.family <> 'relay'
      and not exists (select 1 from manager_awards w
                      where w.league_id = p_league and w.athlete_id = a.id)
  )
  select m.user_id
  from manager_members m, league l, cheapest c
  where m.league_id = p_league
    and l.budget - private.manager_spent(p_league, m.user_id) >= c.price
$$;

-- As in #425; an athlete fits a team while it is under the minimum (`minTeamSize`): the
-- complement stops there. Without a minimum, nobody is given an athlete.
create or replace function private.manager_complement_candidates(p_league uuid, p_user uuid)
returns table (athlete_id uuid, price int)
language sql stable security definer set search_path = public as $$
  with league as (
    select rules, (rules ->> 'budget')::numeric::int as budget,
           (rules ->> 'minTeamSize')::int as min_size
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
    and (select count(*) from team) < l.min_size
    and exists (select 1 from jsonb_array_elements(l.rules -> 'quotas') q
                where q ->> 'sex' = a.gender::text and q ->> 'family' = d.family
                  and (select count(*) from team t
                       where t.sex = a.gender::text and t.family = d.family)
                      < (q ->> 'max')::int)
$$;
