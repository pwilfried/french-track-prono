-- Admin role (v0.4): the back-office writes results and points with the admin's own session.
-- No service_role key in the app. An admin is designated from SQL only (docs/SETUP.md).

alter table profiles add column is_admin boolean not null default false;

-- A player can neither make himself admin nor change anyone's admin flag through the API.
create function protect_admin_flag() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
     and (case when tg_op = 'INSERT' then new.is_admin
               else new.is_admin is distinct from old.is_admin end) then
    raise exception 'is_admin can only be set from SQL' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger protect_admin_flag
  before insert or update on profiles
  for each row execute function protect_admin_flag();

-- True when the signed-in user is an admin. Security definer so that policies can call it
-- without depending on the policies of profiles.
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false)
$$;

-- Results and points: everybody reads (existing policies), only an admin writes.
create policy admin_write on results for all to authenticated
  using (is_admin()) with check (is_admin());
create policy admin_write on score_events for all to authenticated
  using (is_admin()) with check (is_admin());
