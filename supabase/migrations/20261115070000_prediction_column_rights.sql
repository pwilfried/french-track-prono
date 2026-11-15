-- #911 (security audit of 15 Nov 2026): a player writes only his podium, his joker and his marks.
-- Row level security already keeps a player on his own rows; the column rights now keep him off
-- the columns the server writes (competition_id and updated_at by the lock trigger, the points,
-- the dates). He still creates a prediction for an event, but can no longer move it to another.
revoke insert, update on predictions from anon, authenticated;
grant insert (user_id, event_id, p1, p2, p3, use_joker, m1, m2, m3) on predictions to authenticated;
grant update (p1, p2, p3, use_joker, m1, m2, m3) on predictions to authenticated;

-- The lock also covers the event: a prediction moved to another event (by the server) is checked
-- against the lock of that event.
drop trigger trg_prediction_lock on predictions;
create trigger trg_prediction_lock
  before insert or update of event_id, p1, p2, p3, use_joker, m1, m2, m3 on predictions
  for each row execute function enforce_prediction_lock();
