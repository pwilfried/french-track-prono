-- The owner's account in pre-production (#769): pseudo « admin », admin role, member of every
-- prediction league (public or private) and of every Manager league still open to players (#781:
-- mercato not open, a place left under its target), so that what the demo set and the tests leave
-- is in sight without joining each league by hand.
-- Run by ci/preprod/owner.sh (never by hand, never in production), which sets the e-mail first:
--   select set_config('preprod.owner_email', '<e-mail>', false);
-- The e-mail lives in the PREPROD_OWNER_EMAIL secret of the preprod environment, never here.
-- Idempotent: an existing account (signed up before, or made by an earlier run) is kept and only
-- made admin again; memberships are added when missing. Run after each load of the demo set and
-- after each clean-up of the e2e accounts: the leagues the tests make during a run are created
-- after it, so the account never counts in their members or rankings.
begin;

do $$
declare
  v_email text := lower(trim(current_setting('preprod.owner_email', true)));
  v_id uuid;
  v_pseudo text;
begin
  if coalesce(v_email, '') !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'preprod.owner_email is not an e-mail' using errcode = '22023';
  end if;

  select id into v_id from auth.users where lower(email) = v_email order by created_at limit 1;
  if v_id is null then
    v_id := gen_random_uuid();
    -- The columns GoTrue reads as non-null are all set (as in supabase/preprod/demo.sql). No
    -- password: the owner signs in with the e-mail code, as every player.
    insert into auth.users (
      instance_id, id, email, aud, role, email_confirmed_at, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, v_email, 'authenticated', 'authenticated',
      now(), now(), now(), '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (v_id::text, v_id,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email', now(), now());
  end if;

  -- « admin » unless another account already holds it: then the account keeps its pseudo.
  v_pseudo := case when exists (select 1 from profiles where lower(pseudo) = 'admin' and id <> v_id)
                   then null else 'admin' end;
  insert into profiles (id, pseudo, age_confirmed_at, is_admin)
  values (v_id, coalesce(v_pseudo, 'admin-' || left(v_id::text, 8)), now(), true)
  on conflict (id) do update
    set is_admin = true,
        pseudo = coalesce(v_pseudo, profiles.pseudo),
        age_confirmed_at = coalesce(profiles.age_confirmed_at, now()),
        blocked_at = null,
        inactivity_warned_at = null;

  -- Every prediction league, public or private.
  insert into league_members (league_id, user_id, role)
  select l.id, v_id, 'member' from leagues l
  on conflict do nothing;

  -- Every Manager league a player could still join (#781), as private.enter_manager_league: the
  -- mercato not open, a place left under the target its competitions call for. Never more: an
  -- extra player would break the home-and-away of the season.
  insert into manager_members (league_id, user_id)
  select l.id, v_id from manager_leagues l
  where l.mercato_opened_at is null
    and (select count(*) from manager_members m where m.league_id = l.id) < l.player_target
  on conflict do nothing;

  -- Out of the Manager leagues an earlier run made go over their target (before #781).
  delete from manager_members mm
  using manager_leagues l
  where mm.league_id = l.id and mm.user_id = v_id and l.owner_id <> v_id
    and (select count(*) from manager_members m where m.league_id = l.id) > l.player_target;
end $$;

commit;
