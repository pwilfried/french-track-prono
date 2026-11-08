-- Disciplines (v0.9): one row per discipline, with how its marks read, which way is better and
-- the tolerance of the performance prediction (adjustable by the admin). Events, athlete
-- disciplines and records keep the discipline name, now a foreign key to this table.
create table disciplines (
  name            text primary key,
  family          text not null check (family in ('sprint', 'hurdles', 'middle', 'long',
                    'horizontal_jumps', 'vertical_jumps', 'throws', 'combined', 'relay')),
  unit            text not null check (unit in ('time', 'distance', 'points')),
  lower_is_better boolean not null,
  -- Seconds, metres or points.
  tolerance       numeric not null check (tolerance > 0)
);

alter table disciplines enable row level security;
create policy read_all on disciplines for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on disciplines from anon, authenticated;

insert into disciplines (name, family, unit, lower_is_better, tolerance) values
  ('100 m', 'sprint', 'time', true, 0.05),
  ('200 m', 'sprint', 'time', true, 0.05),
  ('400 m', 'sprint', 'time', true, 0.05),
  ('100 m haies', 'hurdles', 'time', true, 0.05),
  ('110 m haies', 'hurdles', 'time', true, 0.05),
  ('400 m haies', 'hurdles', 'time', true, 0.05),
  ('800 m', 'middle', 'time', true, 0.5),
  ('1500 m', 'middle', 'time', true, 0.5),
  ('3000 m steeple', 'long', 'time', true, 2),
  ('5000 m', 'long', 'time', true, 2),
  ('10 000 m', 'long', 'time', true, 2),
  ('Saut en longueur', 'horizontal_jumps', 'distance', false, 0.05),
  ('Triple saut', 'horizontal_jumps', 'distance', false, 0.05),
  ('Saut en hauteur', 'vertical_jumps', 'distance', false, 0.02),
  ('Saut à la perche', 'vertical_jumps', 'distance', false, 0.02),
  ('Lancer du poids', 'throws', 'distance', false, 0.5),
  ('Lancer du disque', 'throws', 'distance', false, 0.5),
  ('Lancer du marteau', 'throws', 'distance', false, 0.5),
  ('Javelot', 'throws', 'distance', false, 0.5),
  ('Heptathlon', 'combined', 'points', false, 50),
  ('Décathlon', 'combined', 'points', false, 50),
  ('Relais 4x100 m', 'relay', 'time', true, 0.05),
  ('Relais 4x400 m', 'relay', 'time', true, 0.05),
  ('Relais mixte 4x100 m', 'relay', 'time', true, 0.05),
  ('Relais mixte 4x400 m', 'relay', 'time', true, 0.05);

-- Any other discipline already used gets a row guessed from its name, so the keys hold.
insert into disciplines (name, family, unit, lower_is_better, tolerance)
select distinct name,
       case when lower_is_better(name) then 'middle' else 'throws' end,
       case when lower_is_better(name) then 'time' else 'distance' end,
       lower_is_better(name), 0.5
from (
  select discipline as name from events
  union select discipline from athlete_disciplines
  union select discipline from athlete_records
) used
where name not in (select name from disciplines)
on conflict do nothing;

alter table events
  add constraint events_discipline_fkey foreign key (discipline) references disciplines(name) on update cascade;
alter table athlete_disciplines
  add constraint athlete_disciplines_discipline_fkey foreign key (discipline) references disciplines(name) on update cascade;
alter table athlete_records
  add constraint athlete_records_discipline_fkey foreign key (discipline) references disciplines(name) on update cascade;

-- The direction now comes from the table (the name pattern stays as a fallback).
create or replace function lower_is_better(p_discipline text) returns boolean
language sql stable as $$
  select coalesce(
    (select d.lower_is_better from disciplines d where d.name = p_discipline),
    p_discipline ~* '\d\s?m(\s|$)|haies|steeple|marche|relais')
$$;

create or replace function is_better_mark(p_discipline text, p_old numeric, p_new numeric)
returns boolean language sql stable as $$
  select p_new is not null and (
    p_old is null
    or (lower_is_better(p_discipline) and p_new < p_old)
    or (not lower_is_better(p_discipline) and p_new > p_old))
$$;

-- The admin adjusts the tolerance of a discipline. Logged with the other back-office actions.
create function set_discipline_tolerance(p_discipline text, p_tolerance numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can change a tolerance' using errcode = '42501';
  end if;
  update disciplines set tolerance = p_tolerance where name = p_discipline;
  if not found then
    raise exception 'unknown discipline' using errcode = 'FT003';
  end if;
  perform private.log_admin_action('set_tolerance', null,
    jsonb_build_object('discipline', p_discipline, 'tolerance', p_tolerance));
end $$;

revoke execute on function set_discipline_tolerance(text, numeric) from public, anon;
grant execute on function set_discipline_tolerance(text, numeric) to authenticated;

-- The log accepts the new action.
alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance'));
