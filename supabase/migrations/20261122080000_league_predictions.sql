-- The leagues a prediction counts in (#1068, decision of the owner, 22 Nov 2026): a podium always
-- counts in the general ranking, and in a league only once the player has added it there. Only
-- the player adds or removes it, and only before the lock of the event. A league that does not
-- count the competition of the event takes nothing.
--
-- Leaving a league removes its links (foreign key on the membership); forgetting a prediction
-- removes them too (trigger below). No foreign key on the prediction: the score lines written
-- for the tests carry no prediction, and the row level security asks for one anyway.

create table league_predictions (
  league_id uuid not null,
  user_id   uuid not null,
  event_id  uuid not null references events(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (league_id, user_id, event_id),
  foreign key (league_id, user_id) references league_members(league_id, user_id) on delete cascade
);
create index on league_predictions (user_id, event_id);

alter table league_predictions enable row level security;
revoke all on league_predictions from anon;
revoke update, truncate on league_predictions from authenticated;

-- True while the event is open to predictions (same rule as enforce_prediction_lock).
create function private.event_open(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = p_event and now() < lock_at)
$$;

-- True when the signed-in player has a prediction on the event.
create function private.my_prediction(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from predictions where user_id = auth.uid() and event_id = p_event)
$$;

-- A prediction forgotten counts nowhere any more.
create function private.forget_prediction_leagues() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from league_predictions where user_id = old.user_id and event_id = old.event_id;
  return old;
end $$;
create trigger trg_forget_prediction_leagues after delete on predictions
  for each row execute function private.forget_prediction_leagues();

-- True when the league counts the competition of the event.
create function private.league_counts_event(p_league uuid, p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_competitions lc join events e on e.competition_id = lc.competition_id
                 where lc.league_id = p_league and e.id = p_event)
$$;

-- The members of a league read what counts in it: its ranking is the same for each of them.
create policy members_read on league_predictions for select to authenticated
  using (is_league_member(league_id));
-- The player adds their own prediction (the foreign key asks for the membership), before the
-- lock, to a league that counts its competition.
create policy own_insert on league_predictions for insert to authenticated
  with check (user_id = auth.uid() and private.my_prediction(event_id)
              and private.event_open(event_id)
              and private.league_counts_event(league_id, event_id));
create policy own_delete on league_predictions for delete to authenticated
  using (user_id = auth.uid() and private.event_open(event_id));

-- The leagues the player's prediction of an event counts in, exactly: the others are removed.
-- Security invoker: row level security decides. FT043 once the event is locked.
create function set_prediction_leagues(p_event uuid, p_leagues uuid[]) returns void
language plpgsql set search_path = public as $$
begin
  if not private.event_open(p_event) then
    raise exception 'the event is locked' using errcode = 'FT043';
  end if;
  delete from league_predictions
  where user_id = auth.uid() and event_id = p_event
    and not (league_id = any (coalesce(p_leagues, '{}')));
  insert into league_predictions (league_id, user_id, event_id)
  select distinct l, auth.uid(), p_event from unnest(coalesce(p_leagues, '{}')) l
  on conflict do nothing;
end $$;
revoke execute on function set_prediction_leagues(uuid, uuid[]) from public, anon;
grant execute on function set_prediction_leagues(uuid, uuid[]) to authenticated;

-- Taking over (#1068): every prediction already made stays in each league of its player that
-- counts its competition, as it counted before. The rules of the app (join date, entry of the
-- competition, families) keep applying on top.
insert into league_predictions (league_id, user_id, event_id, added_at)
select lm.league_id, p.user_id, p.event_id, p.created_at
from predictions p
join league_members lm on lm.user_id = p.user_id
join league_competitions lc on lc.league_id = lm.league_id and lc.competition_id = p.competition_id
on conflict do nothing;

-- The members of a league with their points and rank: a member counts the events locked after
-- joining (same rule as countsInLeague in src/application/rankings.ts), and only the predictions
-- added to the league (#1068).
create or replace function admin_league_members(p_league uuid)
returns table (user_id uuid, pseudo text, bib_number smallint, bib_color text, is_owner boolean,
               joined_at timestamptz, points bigint, rank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin reads the members of a league' using errcode = '42501';
  end if;
  return query
  with member_points as (
    select m.user_id, m.joined_at,
           coalesce(sum(s.points) filter (
             where e.lock_at >= m.joined_at
               and exists (select 1 from league_predictions lp
                           where lp.league_id = m.league_id and lp.user_id = m.user_id
                             and lp.event_id = s.event_id)), 0)::bigint as points
    from league_members m
    left join league_competitions lc on lc.league_id = m.league_id
    left join score_events s on s.user_id = m.user_id and s.competition_id = lc.competition_id
                             and s.event_id is not null
    left join events e on e.id = s.event_id
    where m.league_id = p_league
    group by m.user_id, m.joined_at
  )
  select mp.user_id, p.pseudo, p.bib_number, p.bib_color, l.owner_id = mp.user_id, mp.joined_at,
         mp.points, rank() over (order by mp.points desc)
  from member_points mp
  join profiles p on p.id = mp.user_id
  join leagues l on l.id = p_league
  order by mp.points desc, lower(p.pseudo);
end $$;

-- The leagues counting a competition, as the moments need them: each member now carries the
-- events of the predictions they added to the league (#1068).
create or replace function admin_moment_leagues(p_competition text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin publishes the moments' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'competitions', (select jsonb_agg(jsonb_build_object('slug', c.slug, 'added_at', lc.added_at))
                       from league_competitions lc join competitions c on c.id = lc.competition_id
                       where lc.league_id = l.id),
      'families', (select coalesce(jsonb_agg(jsonb_build_object('family', f.family,
                                                                'added_at', f.added_at)), '[]')
                   from league_families f where f.league_id = l.id),
      'members', (select jsonb_agg(jsonb_build_object(
                    'user_id', m.user_id,
                    'joined_at', m.joined_at,
                    'counted', (select coalesce(jsonb_agg(lp.event_id), '[]')
                                from league_predictions lp
                                where lp.league_id = l.id and lp.user_id = m.user_id)))
                  from league_members m where m.league_id = l.id)))
    from leagues l
    where exists (select 1 from league_competitions lc join competitions c on c.id = lc.competition_id
                  where lc.league_id = l.id and c.slug = p_competition)), '[]');
end $$;

-- What the trophies of a season are drawn from: each member now carries the events of the
-- predictions they added to the league (#1068).
create or replace function admin_trophy_facts(p_season int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'only an admin draws the trophies' using errcode = '42501';
  end if;
  with season_leagues as (
    select lc.league_id
    from league_competitions lc join competitions c on c.id = lc.competition_id
    group by lc.league_id
    having extract(year from max(c.ends_on))::int = p_season
  ),
  league_json as (
    select jsonb_build_object(
      'id', l.id,
      'name', l.name,
      'members', coalesce((select jsonb_agg(jsonb_build_object(
                                     'user_id', m.user_id,
                                     'joined_at', m.joined_at,
                                     'counted', (select coalesce(jsonb_agg(lp.event_id), '[]')
                                                 from league_predictions lp
                                                 where lp.league_id = l.id
                                                   and lp.user_id = m.user_id))
                                            order by m.joined_at, m.user_id)
                           from league_members m where m.league_id = l.id), '[]'::jsonb),
      'competitions', (select jsonb_agg(jsonb_build_object('slug', c.slug, 'ends_on', c.ends_on,
                                                           'added_at', lc.added_at)
                                        order by c.ends_on, c.slug)
                       from league_competitions lc join competitions c on c.id = lc.competition_id
                       where lc.league_id = l.id),
      'families', coalesce((select jsonb_agg(jsonb_build_object('family', f.family,
                                                                'added_at', f.added_at)
                                             order by f.family)
                            from league_families f where f.league_id = l.id), '[]'::jsonb)
    ) as j
    from leagues l join season_leagues s on s.league_id = l.id
  )
  select jsonb_build_object(
    'witness_id', (select witness_id from trophy_settings),
    'competitions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'ends_on', c.ends_on)
                       order by c.ends_on, c.slug)
      from competitions c
      where extract(year from c.ends_on)::int = p_season
         or exists (select 1 from league_competitions lc join season_leagues s using (league_id)
                    where lc.competition_id = c.id)), '[]'::jsonb),
    'leagues', coalesce((select jsonb_agg(j) from league_json), '[]'::jsonb),
    'manager', coalesce((
      select jsonb_agg(jsonb_build_object(
               'league_id', h.league_id,
               'league_name', coalesce(ml.name, ''),
               'ended_at', h.ended_at,
               'standings', (select jsonb_agg(jsonb_build_object('user_id', x ->> 'user_id',
                                                                 'rank', (x ->> 'rank')::int))
                             from jsonb_array_elements(h.standings) x))
             order by h.ended_at, h.league_id)
      from manager_honours h left join manager_leagues ml on ml.id = h.league_id
      where extract(year from h.ended_at at time zone 'Europe/Paris')::int = p_season), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
