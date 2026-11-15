-- #913 (security audit of 15 Nov 2026): two caps.
-- A player sends at most 20 reports (public leagues and moment reactions) in 24 hours; beyond,
-- FT035. Reporting again what was already reported still changes nothing and does not count.
-- A player keeps at most 10 notification devices: saving an eleventh forgets the oldest.

-- Refuses a new report when the signed-in player sent 20 in the last 24 hours.
create function private.check_report_limit() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if (select count(*) from league_reports
      where user_id = auth.uid() and created_at > now() - interval '24 hours')
   + (select count(*) from moment_reaction_reports
      where user_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too many reports' using errcode = 'FT035';
  end if;
end $$;
revoke execute on function private.check_report_limit() from public, anon;
grant execute on function private.check_report_limit() to authenticated;

create or replace function report_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from leagues where id = p_league and is_public) then
    raise exception 'unknown public league' using errcode = 'P0002';
  end if;
  if exists (select 1 from league_reports where league_id = p_league and user_id = auth.uid()) then
    return;
  end if;
  perform private.check_report_limit();
  insert into league_reports (league_id, user_id) values (p_league, auth.uid())
  on conflict do nothing;
end $$;

create or replace function report_moment_reaction(p_reaction uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from moment_reactions
                 where id = p_reaction and hidden_at is null and is_league_member(league_id)) then
    raise exception 'unknown reaction' using errcode = 'P0002';
  end if;
  if exists (select 1 from moment_reaction_reports
             where reaction_id = p_reaction and user_id = auth.uid()) then
    return;
  end if;
  perform private.check_report_limit();
  insert into moment_reaction_reports (reaction_id, user_id) values (p_reaction, auth.uid())
  on conflict do nothing;
end $$;

create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  -- Ten devices at most: the oldest ones go.
  delete from push_subscriptions
  where user_id = auth.uid()
    and endpoint not in (select endpoint from push_subscriptions where user_id = auth.uid()
                         order by created_at desc, endpoint limit 10);
end $$;
