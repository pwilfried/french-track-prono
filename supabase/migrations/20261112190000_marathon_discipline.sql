-- #611: the marathon is a long-distance race, timed, lower is better. In production it was stored
-- as a throw (distance, higher is better), which reversed the order of its marks and put it in the
-- wrong Manager family. Locally it did not exist yet, so the Euro 2026 data could not load it.
-- Tolerance in seconds, like the other long races (adjustable by the admin).
insert into disciplines (name, family, unit, lower_is_better, tolerance)
values ('Marathon', 'long', 'time', true, 30)
on conflict (name) do update
  set family = excluded.family,
      unit = excluded.unit,
      lower_is_better = excluded.lower_is_better,
      tolerance = excluded.tolerance;
