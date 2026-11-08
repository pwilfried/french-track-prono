-- Rounds (v0.8): heats, quarter-finals and semi-finals lead to a final. An earlier round points to
-- the round it leads to (`parent_id`). Players predict finals only, and a final only once every
-- round leading to it is finished (option A).
alter table events
  add column parent_id uuid references events(id) on delete set null,
  add constraint round_values check (round in ('series', 'quarter', 'semi', 'final')),
  add constraint not_its_own_round check (parent_id <> id);
create index on events (parent_id);

-- True when the event is a final whose earlier rounds are all finished.
create function is_predictable(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select e.round = 'final'
     and not exists (select 1 from events r where r.parent_id = e.id and r.status <> 'finished')
  from events e where e.id = p_event
$$;

-- The lock trigger also refuses a heat, or a final whose rounds are not finished (FT001).
create or replace function enforce_prediction_lock() returns trigger
language plpgsql as $$
declare
  v_lock timestamptz;
  v_comp uuid;
begin
  select lock_at, competition_id into v_lock, v_comp from events where id = new.event_id;
  if now() >= v_lock then
    raise exception 'prediction locked: the event has started' using errcode = 'P0001';
  end if;
  if not is_predictable(new.event_id) then
    raise exception 'prediction not open: earlier rounds are not finished' using errcode = 'FT001';
  end if;
  new.competition_id := v_comp;
  new.updated_at := now();
  return new;
end $$;

-- Puts the first `p_top` of a round on the start list of the round it leads to (ties included:
-- everybody ranked p_top or better). Admin only; athletes already there are kept.
create function promote_to_next_round(p_event uuid, p_top int) returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_next uuid;
  added int;
begin
  if not is_admin() then
    raise exception 'only an admin can promote athletes' using errcode = '42501';
  end if;
  select parent_id into v_next from events where id = p_event;
  if v_next is null then
    raise exception 'this round leads to no other round' using errcode = 'FT002';
  end if;
  insert into entries (event_id, athlete_id, season_best)
  select v_next, r.athlete_id, r.mark
  from results r where r.event_id = p_event and r.rank <= p_top
  on conflict (event_id, athlete_id) do nothing;
  get diagnostics added = row_count;
  perform private.log_admin_action('set_start_list', v_next,
    jsonb_build_object('promoted_from', p_event, 'top', p_top));
  return added;
end $$;

revoke execute on function promote_to_next_round(uuid, int) from public, anon;
grant execute on function promote_to_next_round(uuid, int) to authenticated;
