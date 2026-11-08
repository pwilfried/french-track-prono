-- v0.7 (#155): invite codes cannot be guessed in bulk. A wrong code is remembered; after 10
-- wrong codes in an hour, the player cannot join with a code until the hour has passed.
-- join_league now returns null for an unknown code (instead of raising), so that the failed
-- attempt is kept. Error code: FT012 too many wrong codes.

create table league_join_failures (
  user_id uuid not null references profiles(id) on delete cascade,
  at      timestamptz not null default now()
);
create index on league_join_failures (user_id, at);
alter table league_join_failures enable row level security;
revoke all on league_join_failures from anon, authenticated;

create or replace function join_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if (select count(*) from league_join_failures
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'too many wrong codes, try again later' using errcode = 'FT012';
  end if;
  select id into v_league from leagues
  where invite_code = upper(regexp_replace(p_code, '\s', '', 'g'));
  if v_league is null then
    insert into league_join_failures (user_id) values (auth.uid());
    return null;
  end if;
  return enter_league(v_league);
end $$;
