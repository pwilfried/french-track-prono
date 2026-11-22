-- The leagues counting a competition, as the moments need them: each league now carries the
-- jokers played in it (#1114), counted like in its ranking (#1090).
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
                  from league_members m where m.league_id = l.id),
      'jokers', (select coalesce(jsonb_agg(jsonb_build_object('user_id', jp.user_id,
                                                              'event_id', jp.event_id,
                                                              'kind', jp.kind)), '[]')
                 from league_joker_plays jp where jp.league_id = l.id)))
    from leagues l
    where exists (select 1 from league_competitions lc join competitions c on c.id = lc.competition_id
                  where lc.league_id = l.id and c.slug = p_competition)), '[]');
end $$;

-- What the trophies of a season are drawn from: each league now carries the jokers played in it
-- (#1114), counted like in its ranking (#1090).
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
                            from league_families f where f.league_id = l.id), '[]'::jsonb),
      'jokers', coalesce((select jsonb_agg(jsonb_build_object('user_id', jp.user_id,
                                                              'event_id', jp.event_id,
                                                              'kind', jp.kind)
                                           order by jp.event_id, jp.user_id)
                          from league_joker_plays jp where jp.league_id = l.id), '[]'::jsonb)
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
