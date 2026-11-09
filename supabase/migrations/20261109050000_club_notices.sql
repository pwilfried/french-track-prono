-- #372: a player learns, once, that the admin validated, renamed or removed their club.

create table club_notices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('validated', 'renamed', 'removed')),
  club_name text not null,
  new_name text,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index on club_notices (profile_id) where seen_at is null;

alter table club_notices enable row level security;
create policy own_read on club_notices for select to authenticated using (profile_id = auth.uid());
revoke insert, update, delete, truncate on club_notices from anon, authenticated;

-- The player closes a notice.
create function dismiss_club_notice(p_notice uuid) returns void
language sql security definer set search_path = public as $$
  update club_notices set seen_at = now() where id = p_notice and profile_id = auth.uid()
$$;
revoke execute on function dismiss_club_notice(uuid) from public, anon;
grant execute on function dismiss_club_notice(uuid) to authenticated;

-- Written by the database when a club changes, for the players who chose it.
create function notify_club_players() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into club_notices (profile_id, kind, club_name)
    select p.id, 'removed', old.name from profiles p where p.club_id = old.id;
    return old;
  end if;
  if not old.validated and new.validated then
    insert into club_notices (profile_id, kind, club_name)
    select p.id, 'validated', new.name from profiles p where p.club_id = new.id;
  end if;
  -- Only the clubs players typed: renaming an imported club is no news for its players.
  if old.source = 'player' and new.name is distinct from old.name then
    insert into club_notices (profile_id, kind, club_name, new_name)
    select p.id, 'renamed', old.name, new.name from profiles p where p.club_id = new.id;
  end if;
  return new;
end $$;

create trigger clubs_notify_players_update
after update of validated, name on clubs
for each row execute function notify_club_players();

create trigger clubs_notify_players_delete
before delete on clubs
for each row execute function notify_club_players();
