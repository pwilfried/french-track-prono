-- #1135: a new trophy is celebrated once, on the profile. `seen_at` says when the player closed the
-- celebration; null means not shown yet. The trophies awarded before this migration count as
-- already seen (no retroactive celebration). A trophy that changes metal is new again.

alter table trophies add column seen_at timestamptz;
update trophies set seen_at = now() where seen_at is null;

create function trophies_unsee_new_metal() returns trigger
language plpgsql as $$
begin
  if new.metal is distinct from old.metal then
    new.seen_at := null;
  end if;
  return new;
end $$;
create trigger trophies_unsee_new_metal before update on trophies
  for each row execute function trophies_unsee_new_metal();

-- The signed-in player marks their own trophies as seen; nobody else's, and nothing else.
create function mark_my_trophies_seen() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update trophies set seen_at = now() where user_id = auth.uid() and seen_at is null;
end $$;
revoke execute on function mark_my_trophies_seen() from public, anon;
grant execute on function mark_my_trophies_seen() to authenticated;
