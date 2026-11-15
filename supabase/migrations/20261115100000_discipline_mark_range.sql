-- Plausible marks per discipline (#935): a 1500 m is plausible from 3:20 to 5:30, not from 1:30
-- to 15:00 like any middle-distance race. The ranges mirror `BY_DISCIPLINE` in
-- src/domain/mark-range.ts: change both together. A discipline not listed here (or measured in
-- another unit) keeps the range of its family, then of its unit (`mark_range`, #702).
--
-- Error code: FT031 (unchanged) a predicted mark outside the range of the event's discipline.
-- Marks already saved are left as they are: only a new or changed mark is checked.

create function discipline_mark_range(
  p_discipline text, p_family text, p_unit text, out lo numeric, out hi numeric
)
language sql immutable set search_path = public as $$
  select coalesce(n.lo, r.lo), coalesce(n.hi, r.hi)
  from mark_range(p_family, p_unit) r
  left join (values
    ('100 m', 'time', 9, 14),
    ('200 m', 'time', 18.5, 28),
    ('400 m', 'time', 42, 65),
    ('100 m haies', 'time', 11.5, 17),
    ('110 m haies', 'time', 12.5, 18),
    ('400 m haies', 'time', 44, 70),
    ('800 m', 'time', 95, 160),
    ('1500 m', 'time', 200, 330),
    ('3000 m steeple', 'time', 450, 720),
    ('5000 m', 'time', 720, 1200),
    ('10 000 m', 'time', 1500, 2400),
    ('Marathon', 'time', 6900, 12600),
    ('Relais 4x100 m', 'time', 35, 50),
    ('Relais 4x400 m', 'time', 170, 240),
    ('Relais mixte 4x100 m', 'time', 38, 52),
    ('Relais mixte 4x400 m', 'time', 175, 250),
    ('Saut en longueur', 'distance', 5, 9.5),
    ('Triple saut', 'distance', 11, 19),
    ('Saut en hauteur', 'distance', 1.5, 2.6),
    ('Saut à la perche', 'distance', 3.5, 6.8),
    ('Lancer du poids', 'distance', 12, 25),
    ('Lancer du disque', 'distance', 45, 80),
    ('Lancer du marteau', 'distance', 55, 90),
    ('Javelot', 'distance', 45, 100),
    ('Heptathlon', 'points', 4500, 7600),
    ('Décathlon', 'points', 6000, 9400)
  ) as n(name, unit, lo, hi) on n.name = p_discipline and n.unit = p_unit
$$;

-- True when a predicted mark (null: none) is plausible for the discipline of the event.
create or replace function mark_in_range(p_event_id uuid, p_mark numeric)
returns boolean language sql stable set search_path = public as $$
  select p_mark is null or exists (
    select 1
    from events e
    left join disciplines d on d.name = e.discipline
    cross join lateral discipline_mark_range(e.discipline, d.family, d.unit) r
    where e.id = p_event_id and p_mark between r.lo and r.hi
  )
$$;
