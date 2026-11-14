-- #680: what the players predicted on an event, once it is locked. The podiums come back without
-- any name (only whether the podium is the caller's), so that the percentages are computed in
-- `src/domain/consensus.ts`. Nothing before the lock, even through the API; a league's consensus
-- is readable by its members only.
-- Error codes: 42501 not signed in or not a member of the league, FT033 the event is not locked.
create function event_consensus(p_event uuid, p_league uuid default null)
returns table (p1 uuid, p2 uuid, p3 uuid, mine boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from events e where e.id = p_event and e.lock_at <= now()) then
    raise exception 'event not locked' using errcode = 'FT033';
  end if;
  if p_league is not null and not is_league_member(p_league) then
    raise exception 'not a member of this league' using errcode = '42501';
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
revoke execute on function event_consensus(uuid, uuid) from public, anon;
grant execute on function event_consensus(uuid, uuid) to authenticated;
