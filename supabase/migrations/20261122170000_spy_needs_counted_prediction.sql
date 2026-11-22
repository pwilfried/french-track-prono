-- Jokers as playing cards (#1121, decision of the owner, 22 Nov 2026): every joker, the spy
-- included, is played on a prediction added to the league. A league the prediction does not count
-- in shows no card, and the database refuses a joker there (FT047). Taking the prediction out of
-- the league still gives its joker back, except the spy (spent once seen).

create or replace function play_league_joker(p_league uuid, p_event uuid, p_kind text) returns void
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
     or not exists (select 1 from league_predictions
                    where league_id = p_league and user_id = v_uid and event_id = p_event) then
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
