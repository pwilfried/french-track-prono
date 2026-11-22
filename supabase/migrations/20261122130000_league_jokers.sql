-- League jokers (#1090, decision of the owner, 22 Nov 2026). The joker becomes a resource of a
-- league: several jokers, each played once in the whole league, on one event, one joker per event
-- and per league. Its points count in the league's ranking only, never in the general one. The
-- joker of a competition (x2, `use_joker`) goes away; the jokers already played in preprod are
-- dropped (no player in production).
--
-- What each joker makes of a prediction is computed with the general points
-- (src/domain/league-jokers.ts) and stored in `score_events.detail.jokers`; the ranking of a
-- league counts the points of the joker played on the event, the general ranking `points`.
--
-- Error codes: 42501 not signed in, not a member or not an admin; FT043 the event is locked;
-- FT045 the joker is not in the player's hand (not in the league, or already played elsewhere);
-- FT046 the spy is already played on the event (spent once seen); FT047 the prediction is not in
-- the league (the spy only needs the league to count the event).

-- ---------------------------------------------------------------------------------------------
-- The joker of a competition goes away.

drop index if exists one_joker_per_competition;
drop trigger trg_prediction_lock on predictions;
alter table predictions drop column use_joker;
create trigger trg_prediction_lock
  before insert or update of event_id, p1, p2, p3, m1, m2, m3 on predictions
  for each row execute function enforce_prediction_lock();
revoke insert, update on predictions from anon, authenticated;
grant insert (user_id, event_id, p1, p2, p3, m1, m2, m3) on predictions to authenticated;
grant update (p1, p2, p3, m1, m2, m3) on predictions to authenticated;

delete from scoring_rules where key = 'joker_multiplier';
-- The score lines no longer explain a joker: the points of the general ranking never had one.
update score_events
set points = points / 2,
    detail = jsonb_set(detail, '{reasons}',
                       (select coalesce(jsonb_agg(r), '[]') from jsonb_array_elements(detail -> 'reasons') r
                        where r ->> 'kind' <> 'joker'))
where source = 'prediction' and detail -> 'reasons' @> '[{"kind": "joker"}]';

-- ---------------------------------------------------------------------------------------------
-- The catalogue: the jokers of each game, shared with the Manager (#1091). Adding a kind of
-- joker needs code; the admin only turns one on or off.

create table jokers (
  game     text not null check (game in ('predictions', 'manager')),
  kind     text not null check (kind ~ '^[a-z_]{1,30}$'),
  active   boolean not null default true,
  position smallint not null default 0,
  primary key (game, kind)
);
insert into jokers (game, kind, position) values
  ('predictions', 'double', 1),
  ('predictions', 'all_or_nothing', 2),
  ('predictions', 'safety_net', 3),
  ('predictions', 'spy', 4),
  ('predictions', 'outsider', 5);

alter table jokers enable row level security;
revoke insert, update, delete, truncate on jokers from anon, authenticated;
-- The screen that creates a league shows them to every player.
create policy read_all on jokers for select to anon, authenticated using (true);

-- The admin turns a joker on or off. A league keeps the jokers it received.
create function set_joker_active(p_game text, p_kind text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin sets the jokers' using errcode = '42501';
  end if;
  update jokers set active = p_active where game = p_game and kind = p_kind;
  if not found then
    raise exception 'unknown joker' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function set_joker_active(text, text, boolean) from public, anon;
grant execute on function set_joker_active(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The jokers of each prediction league: every active joker of the game when it is created, a
-- snapshot that the catalogue no longer changes.

create table league_jokers (
  league_id uuid not null references leagues(id) on delete cascade,
  kind      text not null,
  primary key (league_id, kind)
);

alter table league_jokers enable row level security;
revoke insert, update, delete, truncate on league_jokers from anon, authenticated;
create policy members_read on league_jokers for select to authenticated
  using (is_league_member(league_id) or is_admin());

create function private.give_league_jokers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into league_jokers (league_id, kind)
  select new.id, j.kind from jokers j where j.game = 'predictions' and j.active;
  return new;
end $$;
create trigger trg_give_league_jokers after insert on leagues
  for each row execute function private.give_league_jokers();

-- The leagues already there receive the jokers of today.
insert into league_jokers (league_id, kind)
select l.id, j.kind from leagues l cross join jokers j where j.game = 'predictions' and j.active;

-- ---------------------------------------------------------------------------------------------
-- The jokers played: by (prediction, league), once in the league, one per event. Leaving the
-- league removes them; removing the prediction from the league removes its joker, except the spy
-- (spent once seen).

create table league_joker_plays (
  league_id uuid not null,
  user_id   uuid not null,
  event_id  uuid not null references events(id) on delete cascade,
  kind      text not null,
  played_at timestamptz not null default now(),
  primary key (league_id, user_id, kind),
  unique (league_id, user_id, event_id),
  foreign key (league_id, user_id) references league_members(league_id, user_id) on delete cascade,
  foreign key (league_id, kind) references league_jokers(league_id, kind) on delete cascade
);
create index on league_joker_plays (event_id);

alter table league_joker_plays enable row level security;
revoke insert, update, delete, truncate on league_joker_plays from anon, authenticated;
-- A player sees their own jokers; the other members see them once the event is locked.
create policy read_own_or_locked on league_joker_plays for select to authenticated
  using (user_id = auth.uid()
         or (is_league_member(league_id) and not private.event_open(event_id))
         or is_admin());

create function private.drop_league_joker() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from league_joker_plays
  where league_id = old.league_id and user_id = old.user_id and event_id = old.event_id
    and kind <> 'spy';
  return old;
end $$;
create trigger trg_drop_league_joker after delete on league_predictions
  for each row execute function private.drop_league_joker();

-- Plays a joker of the league on the signed-in player's prediction of the event, before the
-- lock. A joker already on the event is replaced, except the spy.
create function play_league_joker(p_league uuid, p_event uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_on_event text;
begin
  if v_uid is null or not is_league_member(p_league) then
    raise exception 'not a member of this league' using errcode = '42501';
  end if;
  if not private.event_open(p_event) then
    raise exception 'the event is locked' using errcode = 'FT043';
  end if;
  if not exists (select 1 from league_jokers where league_id = p_league and kind = p_kind)
     or exists (select 1 from league_joker_plays
                where league_id = p_league and user_id = v_uid and kind = p_kind
                  and event_id <> p_event) then
    raise exception 'this joker is not in the hand' using errcode = 'FT045';
  end if;
  if not private.league_counts_event(p_league, p_event)
     or (p_kind <> 'spy' and not exists (select 1 from league_predictions
                                         where league_id = p_league and user_id = v_uid
                                           and event_id = p_event)) then
    raise exception 'the prediction is not in the league' using errcode = 'FT047';
  end if;
  select kind into v_on_event from league_joker_plays
  where league_id = p_league and user_id = v_uid and event_id = p_event;
  if v_on_event = p_kind then
    return;
  end if;
  if v_on_event = 'spy' then
    raise exception 'the spy is spent' using errcode = 'FT046';
  end if;
  delete from league_joker_plays
  where league_id = p_league and user_id = v_uid and event_id = p_event;
  insert into league_joker_plays (league_id, user_id, event_id, kind)
  values (p_league, v_uid, p_event, p_kind);
end $$;
revoke execute on function play_league_joker(uuid, uuid, text) from public, anon;
grant execute on function play_league_joker(uuid, uuid, text) to authenticated;

-- Takes back the joker played on the event, before the lock; never the spy.
create function remove_league_joker(p_league uuid, p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_league_member(p_league) then
    raise exception 'not a member of this league' using errcode = '42501';
  end if;
  if not private.event_open(p_event) then
    raise exception 'the event is locked' using errcode = 'FT043';
  end if;
  if exists (select 1 from league_joker_plays
             where league_id = p_league and user_id = auth.uid() and event_id = p_event
               and kind = 'spy') then
    raise exception 'the spy is spent' using errcode = 'FT046';
  end if;
  delete from league_joker_plays
  where league_id = p_league and user_id = auth.uid() and event_id = p_event;
end $$;
revoke execute on function remove_league_joker(uuid, uuid) from public, anon;
grant execute on function remove_league_joker(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The spy: before the lock, the trend of the league's members on the event, for the player who
-- played it there. Otherwise as before (#680): only once the event is locked.

create or replace function event_consensus(p_event uuid, p_league uuid default null)
returns table (p1 uuid, p2 uuid, p3 uuid, mine boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_league is not null and not is_league_member(p_league) then
    raise exception 'not a member of this league' using errcode = '42501';
  end if;
  if not exists (select 1 from events e where e.id = p_event and e.lock_at <= now())
     and not (p_league is not null
              and exists (select 1 from league_joker_plays j
                          where j.league_id = p_league and j.user_id = auth.uid()
                            and j.event_id = p_event and j.kind = 'spy')) then
    raise exception 'event not locked' using errcode = 'FT033';
  end if;
  return query
    select pr.p1, pr.p2, pr.p3, pr.user_id = auth.uid()
    from predictions pr
    where pr.event_id = p_event
      and (p_league is null or exists (select 1 from league_members m
                                       where m.league_id = p_league and m.user_id = pr.user_id))
    -- Sorted by podium: the order says nothing of who predicted first.
    order by pr.p1, pr.p2, pr.p3;
end $$;

-- ---------------------------------------------------------------------------------------------
-- The back-office ranking of a league counts the jokers played there, like the app.

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
           coalesce(sum(coalesce((s.detail -> 'jokers' ->> jp.kind)::int, s.points)) filter (
             where e.lock_at >= m.joined_at
               and exists (select 1 from league_predictions lp
                           where lp.league_id = m.league_id and lp.user_id = m.user_id
                             and lp.event_id = s.event_id)), 0)::bigint as points
    from league_members m
    left join league_competitions lc on lc.league_id = m.league_id
    left join score_events s on s.user_id = m.user_id and s.competition_id = lc.competition_id
                             and s.event_id is not null
    left join events e on e.id = s.event_id
    left join league_joker_plays jp on jp.league_id = m.league_id and jp.user_id = m.user_id
                                   and jp.event_id = s.event_id
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
