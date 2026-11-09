-- #314: an account without activity for 2 years is deleted, after a warning e-mail at 23 months
-- (CNIL recommendation, announced on the « Confidentialité » page). Activity = signing in, a
-- prediction or a reaction. Run by the « Inactive accounts » workflow as the database owner;
-- none of these functions can be called by the app.

alter table profiles add column inactivity_warned_at timestamptz;

-- Set by the workflow only, never by a player through the API.
create function protect_inactivity_flag() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
     and (case when tg_op = 'INSERT' then new.inactivity_warned_at is not null
               else new.inactivity_warned_at is distinct from old.inactivity_warned_at end) then
    raise exception 'inactivity_warned_at is set by the database only' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger protect_inactivity_flag
  before insert or update on profiles
  for each row execute function protect_inactivity_flag();

-- The latest activity of a player.
create function private.last_activity(p_user uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select created_at from profiles where id = p_user),
    (select last_sign_in_at from auth.users where id = p_user),
    (select max(greatest(created_at, coalesce(updated_at, created_at))) from predictions where user_id = p_user),
    (select max(created_at) from reactions where user_id = p_user)
  )
$$;

-- Players to warn: no activity for 23 months, not warned since their last activity.
create function private.inactive_accounts_to_warn()
returns table (user_id uuid, email text, pseudo text)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text, p.pseudo
  from profiles p join auth.users u on u.id = p.id
  where not p.is_admin
    and private.last_activity(p.id) < now() - interval '23 months'
    and (p.inactivity_warned_at is null or p.inactivity_warned_at < private.last_activity(p.id))
$$;

create function private.mark_inactivity_warned(p_users uuid[]) returns void
language sql security definer set search_path = public as $$
  update profiles set inactivity_warned_at = now() where id = any(p_users)
$$;

-- Deletes the players with no activity for 24 months who were warned at least 3 weeks ago and
-- did nothing since, like « Supprimer mon compte ». Returns how many.
create function private.purge_inactive_accounts() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_count int := 0;
begin
  for v_user in
    select p.id from profiles p
    where not p.is_admin
      and private.last_activity(p.id) < now() - interval '24 months'
      and p.inactivity_warned_at is not null
      and p.inactivity_warned_at >= private.last_activity(p.id)
      and p.inactivity_warned_at <= now() - interval '21 days'
  loop
    perform private.delete_account(v_user);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke execute on function private.last_activity(uuid) from public, anon, authenticated;
revoke execute on function private.inactive_accounts_to_warn() from public, anon, authenticated;
revoke execute on function private.mark_inactivity_warned(uuid[]) from public, anon, authenticated;
revoke execute on function private.purge_inactive_accounts() from public, anon, authenticated;
