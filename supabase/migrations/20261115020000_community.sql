-- v0.19 (#673): the « Dans ma communauté » block of the home. Next to the moments of my leagues,
-- the admin publishes FrenchTrack announcements (a new episode, a competition opening, a schedule
-- published) and simple polls (a question, 2 to 4 answers, a closing date). Players never write
-- text (non-goal 6): they only vote, once per poll, and see the results after their vote or once
-- the poll is closed.
-- Error codes: 42501 not an admin (or not signed in), 22023 invalid input, P0002 unknown poll,
-- 23505 already voted, FT034 the poll is closed.

create table announcements (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('episode', 'competition_open', 'schedule')),
  title        text not null check (length(title) between 1 and 60),
  subtitle     text check (length(subtitle) between 1 and 120),
  -- An https address (the episode to listen to) or a page of the app ("/competitions/…").
  link         text check (length(link) <= 300 and (link like 'https://%' or link like '/%')),
  published_at timestamptz not null default now(),
  -- A new episode always comes with where to listen to it.
  check (kind <> 'episode' or link is not null)
);
create index on announcements (published_at desc);

create table polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null check (length(question) between 1 and 120),
  options    text[] not null check (array_length(options, 1) between 2 and 4),
  closes_at  timestamptz not null,
  created_at timestamptz not null default now()
);
create index on polls (created_at desc);

create table poll_votes (
  poll_id  uuid not null references polls(id) on delete cascade,
  user_id  uuid not null references profiles(id) on delete cascade,
  choice   smallint not null check (choice >= 0 and choice < 4),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- A signed-in player reads the announcements and the polls; a player reads their own vote only.
-- Nobody writes outside the functions below.
alter table announcements enable row level security;
create policy players_read on announcements for select to authenticated using (true);
revoke insert, update, delete, truncate on announcements from anon, authenticated;

alter table polls enable row level security;
create policy players_read on polls for select to authenticated using (true);
revoke insert, update, delete, truncate on polls from anon, authenticated;

alter table poll_votes enable row level security;
create policy own_vote on poll_votes for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on poll_votes from anon, authenticated;

-- Publishes an announcement. Returns its id.
create function admin_publish_announcement(p_kind text, p_title text, p_subtitle text,
                                           p_link text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'only an admin publishes an announcement' using errcode = '42501';
  end if;
  begin
    insert into announcements (kind, title, subtitle, link)
    values (p_kind, btrim(p_title), nullif(btrim(coalesce(p_subtitle, '')), ''),
            nullif(btrim(coalesce(p_link, '')), ''))
    returning id into v_id;
  exception when check_violation then
    raise exception 'invalid announcement' using errcode = '22023';
  end;
  return v_id;
end $$;
revoke execute on function admin_publish_announcement(text, text, text, text) from public, anon;
grant execute on function admin_publish_announcement(text, text, text, text) to authenticated;

create function admin_remove_announcement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin removes an announcement' using errcode = '42501';
  end if;
  delete from announcements where id = p_id;
end $$;
revoke execute on function admin_remove_announcement(uuid) from public, anon;
grant execute on function admin_remove_announcement(uuid) to authenticated;

-- Creates a poll: a question, 2 to 4 distinct answers, closing later. Returns its id.
create function admin_create_poll(p_question text, p_options text[], p_closes_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_options text[];
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'only an admin creates a poll' using errcode = '42501';
  end if;
  select coalesce(array_agg(btrim(o) order by n), '{}') into v_options
  from unnest(p_options) with ordinality as t(o, n) where btrim(coalesce(o, '')) <> '';
  if cardinality(v_options) not between 2 and 4
     or exists (select 1 from unnest(v_options) o where length(o) > 40)
     or (select count(distinct lower(o)) from unnest(v_options) o) <> cardinality(v_options)
     or p_closes_at is null or p_closes_at <= now() then
    raise exception 'invalid poll' using errcode = '22023';
  end if;
  begin
    insert into polls (question, options, closes_at)
    values (btrim(p_question), v_options, p_closes_at)
    returning id into v_id;
  exception when check_violation or not_null_violation then
    raise exception 'invalid poll' using errcode = '22023';
  end;
  return v_id;
end $$;
revoke execute on function admin_create_poll(text, text[], timestamptz) from public, anon;
grant execute on function admin_create_poll(text, text[], timestamptz) to authenticated;

create function admin_remove_poll(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin removes a poll' using errcode = '42501';
  end if;
  delete from polls where id = p_id;
end $$;
revoke execute on function admin_remove_poll(uuid) from public, anon;
grant execute on function admin_remove_poll(uuid) to authenticated;

-- The signed-in player votes once: the answer `p_choice` (0 for the first) of an open poll.
create function vote_poll(p_poll uuid, p_choice int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_poll polls;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'only a player votes' using errcode = '42501';
  end if;
  select * into v_poll from polls where id = p_poll;
  if not found then
    raise exception 'unknown poll' using errcode = 'P0002';
  end if;
  if v_poll.closes_at <= now() then
    raise exception 'poll closed' using errcode = 'FT034';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= cardinality(v_poll.options) then
    raise exception 'invalid answer' using errcode = '22023';
  end if;
  insert into poll_votes (poll_id, user_id, choice) values (p_poll, auth.uid(), p_choice)
  on conflict (poll_id, user_id) do nothing;
  if not found then
    raise exception 'already voted' using errcode = '23505';
  end if;
end $$;
revoke execute on function vote_poll(uuid, int) from public, anon;
grant execute on function vote_poll(uuid, int) to authenticated;

-- The polls the home shows, latest first: the open ones and those closed less than 7 days ago.
-- `votes` (one count per answer) is null until the player has voted, unless the poll is closed:
-- nobody reads the results before taking part (the admin, who follows them, always does).
create function community_polls(p_limit int default 10)
returns table (id uuid, question text, options text[], closes_at timestamptz, my_choice int,
               votes int[])
language sql stable security definer set search_path = public as $$
  select p.id, p.question, p.options, p.closes_at, v.choice::int,
         case when v.choice is not null or p.closes_at <= now() or is_admin() then
           (select array_agg((select count(*) from poll_votes c
                              where c.poll_id = p.id and c.choice = n - 1)::int order by n)
            from generate_series(1, cardinality(p.options)) n)
         end
  from polls p
  left join poll_votes v on v.poll_id = p.id and v.user_id = auth.uid()
  where auth.uid() is not null and p.closes_at > now() - interval '7 days'
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;
revoke execute on function community_polls(int) from public, anon;
grant execute on function community_polls(int) to authenticated;
