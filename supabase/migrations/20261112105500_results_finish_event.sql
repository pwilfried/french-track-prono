-- An event with an official result is finished; once its result is erased it is upcoming again
-- (#488). Kept by a trigger so every way of writing results agrees with the events list, the
-- « Déjà courues » section and the opening of a final after its heats (rounds).
create function private.sync_event_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid := coalesce(new.event_id, old.event_id);
begin
  update events
     set status = case when exists (select 1 from results where event_id = v_event)
                       then 'finished'::event_status else 'upcoming'::event_status end
   where id = v_event;
  return null;
end $$;
revoke execute on function private.sync_event_status() from public, anon, authenticated;

create trigger results_sync_event_status
  after insert or delete on results
  for each row execute function private.sync_event_status();
