-- Plausible marks (#702): a mark predicted with a podium must be a plausible mark of the event's
-- discipline (5 to 20 m for a triple jump), not any number. The ranges mirror `markRange` in
-- src/domain/mark-range.ts: change both together.
--
-- Error codes: FT031 a predicted mark outside the range of the event's discipline; 23514
-- (predictions_marks_bounded) a stored mark that is not a positive, finite number under 100 000.

-- The plausible marks of a discipline, from its family; for a unit unusual in its family (or an
-- unknown discipline), the widest marks of the unit.
create function mark_range(p_family text, p_unit text, out lo numeric, out hi numeric)
language sql immutable set search_path = public as $$
  select coalesce(f.lo, u.lo, 0), coalesce(f.hi, u.hi, 100000)
  from (select 1) one
  left join (values
    ('sprint', 'time', 5, 90),
    ('hurdles', 'time', 6, 90),
    ('relay', 'time', 30, 300),
    ('middle', 'time', 90, 900),
    ('long', 'time', 300, 21600),
    ('horizontal_jumps', 'distance', 5, 20),
    ('vertical_jumps', 'distance', 1, 7),
    ('throws', 'distance', 5, 110),
    ('combined', 'points', 1000, 10000)
  ) as f(family, unit, lo, hi) on f.family = p_family and f.unit = p_unit
  left join (values
    ('time', 5, 21600),
    ('distance', 1, 110),
    ('points', 1000, 10000)
  ) as u(unit, lo, hi) on u.unit = p_unit
$$;

-- True when a predicted mark (null: none) is plausible for the discipline of the event.
create function mark_in_range(p_event_id uuid, p_mark numeric)
returns boolean language sql stable set search_path = public as $$
  select p_mark is null or exists (
    select 1
    from events e
    left join disciplines d on d.name = e.discipline
    cross join lateral mark_range(d.family, d.unit) r
    where e.id = p_event_id and p_mark between r.lo and r.hi
  )
$$;

-- Existing absurd marks: the player's marks outside the range of their event become null, the
-- podium stays. The lock trigger is set aside so that marks of locked events are cleaned too.
alter table predictions disable trigger trg_prediction_lock;
do $$
declare
  touched integer;
begin
  update predictions p
  set m1 = case when mark_in_range(p.event_id, p.m1) then p.m1 end,
      m2 = case when mark_in_range(p.event_id, p.m2) then p.m2 end,
      m3 = case when mark_in_range(p.event_id, p.m3) then p.m3 end
  where not (mark_in_range(p.event_id, p.m1)
             and mark_in_range(p.event_id, p.m2)
             and mark_in_range(p.event_id, p.m3));
  get diagnostics touched = row_count;
  raise notice '#702: % prediction(s) had a mark outside the plausible range, now null', touched;
end $$;
alter table predictions enable trigger trg_prediction_lock;

-- Any stored mark: positive, finite (NaN fails the upper bound) and of a bounded size.
alter table predictions
  add constraint predictions_marks_bounded check (
    (m1 is null or (m1 > 0 and m1 < 100000))
    and (m2 is null or (m2 > 0 and m2 < 100000))
    and (m3 is null or (m3 > 0 and m3 < 100000))
  );

-- Saving a prediction refuses a mark outside the range of the event's discipline.
create function enforce_prediction_mark_range() returns trigger
language plpgsql set search_path = public as $$
begin
  if not (mark_in_range(new.event_id, new.m1)
          and mark_in_range(new.event_id, new.m2)
          and mark_in_range(new.event_id, new.m3)) then
    raise exception 'mark out of range' using errcode = 'FT031';
  end if;
  return new;
end $$;

create trigger trg_prediction_mark_range
  before insert or update of event_id, m1, m2, m3 on predictions
  for each row execute function enforce_prediction_mark_range();

-- A trigger function is executable by nobody through the API (#457).
revoke execute on function enforce_prediction_mark_range() from public, anon, authenticated;
