-- A player could delete a prediction after the lock (the lock trigger only covers insert and update).
-- Only the player's direct deletes go through this policy: deleting an account or an event still
-- removes its predictions through the foreign keys.
drop policy delete_own on predictions;
create policy delete_own_before_lock on predictions for delete to authenticated
  using (user_id = auth.uid()
         and exists (select 1 from events e where e.id = event_id and e.lock_at > now()));
