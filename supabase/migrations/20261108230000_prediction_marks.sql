-- Performance predictions (v0.9, #261): with his podium, a player may predict the mark of each of
-- his three athletes, in the unit of the discipline (seconds, metres or points). Optional, none for
-- « autre athlète », and locked like the podium.
alter table predictions
  add column m1 numeric(10, 2) check (m1 > 0),
  add column m2 numeric(10, 2) check (m2 > 0),
  add column m3 numeric(10, 2) check (m3 > 0),
  add constraint predictions_marks_need_athlete
    check ((m1 is null or p1 is not null) and (m2 is null or p2 is not null) and (m3 is null or p3 is not null));

-- The lock now covers the marks too.
drop trigger trg_prediction_lock on predictions;
create trigger trg_prediction_lock
  before insert or update of p1, p2, p3, use_joker, m1, m2, m3 on predictions
  for each row execute function enforce_prediction_lock();
