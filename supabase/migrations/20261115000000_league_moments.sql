-- v0.19 (#671): the feed of a league. The app tells the moments of the league (perfect podium,
-- new leader, streak…); players never write in it (no free text, non-goal 6). The moments are
-- found in TypeScript (src/domain/league-moments.ts) from the score lines of the league, then
-- published by the admin's computation of points. A moment is a fact named by a key: the same
-- fact published twice is kept once, so running the computation again changes nothing.
-- No text is stored: the feed reads the facts and src/app/messages.fr.ts writes the sentences.
-- Error codes: 42501 not an admin.

create table league_moments (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references leagues(id) on delete cascade,
  -- Names the fact, e.g. perfect_podium:<event>:<player>: one moment per fact and league.
  key            text not null check (length(key) between 1 and 200),
  kind           text not null check (kind in ('perfect_podium', 'new_leader', 'duel_result',
                   'mercato_win', 'badge', 'streak')),
  user_id        uuid not null references profiles(id) on delete cascade,
  other_user_id  uuid references profiles(id) on delete cascade,
  competition_id uuid references competitions(id) on delete cascade,
  event_id       uuid references events(id) on delete cascade,
  -- The figures of the moment (a streak's length…), never a sentence.
  data           jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  -- When it took place: the start of its event (the feed groups by competition day), else when
  -- it was published.
  happened_at    timestamptz not null default now(),
  unique (league_id, key)
);
create index on league_moments (league_id, happened_at desc);

-- A member reads the moments of their leagues; nobody writes outside the functions below.
alter table league_moments enable row level security;
create policy members_read on league_moments for select to authenticated
  using (is_league_member(league_id));
revoke insert, update, delete, truncate on league_moments from anon, authenticated;

-- The leagues counting a competition, with what their ranking needs: competitions (and when they
-- entered the league), families, members (and when they joined). Admin only: the computation of
-- points publishes the moments of every league, the admin's own or not.
create function admin_moment_leagues(p_competition text) returns jsonb
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
      'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id,
                                                      'joined_at', m.joined_at))
                  from league_members m where m.league_id = l.id)))
    from leagues l
    where exists (select 1 from league_competitions lc join competitions c on c.id = lc.competition_id
                  where lc.league_id = l.id and c.slug = p_competition)), '[]');
end $$;
revoke execute on function admin_moment_leagues(text) from public, anon;
grant execute on function admin_moment_leagues(text) to authenticated;

-- Publishes moments in a league: [{key, kind, user_id, event_id?, data?}]. A key already
-- published, or a player who is not a member, is left out. Returns how many moments are new.
create function admin_publish_league_moments(p_league uuid, p_moments jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception 'only an admin publishes the moments' using errcode = '42501';
  end if;
  insert into league_moments (league_id, key, kind, user_id, other_user_id, competition_id,
                              event_id, data, happened_at)
  select p_league, m ->> 'key', m ->> 'kind', (m ->> 'user_id')::uuid,
         nullif(m ->> 'other_user_id', '')::uuid, e.competition_id,
         nullif(m ->> 'event_id', '')::uuid, coalesce(m -> 'data', '{}'),
         coalesce(e.starts_at, now())
  from jsonb_array_elements(p_moments) m
  left join events e on e.id = nullif(m ->> 'event_id', '')::uuid
  where exists (select 1 from league_members lm
                where lm.league_id = p_league and lm.user_id = (m ->> 'user_id')::uuid)
  on conflict (league_id, key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function admin_publish_league_moments(uuid, jsonb) from public, anon;
grant execute on function admin_publish_league_moments(uuid, jsonb) to authenticated;

-- The feed of a league, latest first, as the screen tells it: the players' pseudo and bib only
-- (decision of the owner, 14 Nov 2026), the competition and the event. Security invoker: row
-- level security shows someone outside the league nothing.
create function league_feed(p_league uuid, p_limit int default 100)
returns table (key text, kind text, happened_at timestamptz, pseudo text, bib_number int,
               bib_color text, other_pseudo text, competition_name text, discipline text,
               gender text, data jsonb)
language sql stable set search_path = public as $$
  select m.key, m.kind, m.happened_at, p.pseudo, p.bib_number::int, p.bib_color, o.pseudo, c.name,
         e.discipline, e.gender::text, m.data
  from league_moments m
  join profiles p on p.id = m.user_id
  left join profiles o on o.id = m.other_user_id
  left join competitions c on c.id = m.competition_id
  left join events e on e.id = m.event_id
  where m.league_id = p_league
    -- A blocked player disappears from the league for the others, their moments too.
    and (m.user_id = auth.uid() or not is_blocked(m.user_id))
  order by m.happened_at desc, m.key
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
$$;
revoke execute on function league_feed(uuid, int) from public, anon;
grant execute on function league_feed(uuid, int) to authenticated;
