-- Athlete records (v0.8): personal best (pr), season best (sb), world record and world lead (wr,
-- wb) per athlete and discipline. PR and SB follow the official results automatically; WR and WB
-- are entered by hand. Everybody reads them; nobody writes them through the API.
create table athlete_records (
  athlete_id   uuid not null references athletes(id) on delete cascade,
  discipline   text not null,
  kind         text not null check (kind in ('pr', 'sb', 'wr', 'wb')),
  mark         text not null,
  -- The mark as a number (seconds, metres or points), to compare and sort: see parse_mark.
  mark_value   numeric not null,
  record_date  date,
  meeting_name text,
  verified     boolean not null default false,
  primary key (athlete_id, discipline, kind)
);

alter table athlete_records enable row level security;
create policy read_all on athlete_records for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on athlete_records from anon, authenticated;

-- A mark typed as text, as a number: "10.62" and "12.22" (seconds), "1:56.70" (minutes),
-- "2:05:30" (hours), "2.34" or "2m34" or "8.12 m" (metres), "8125 pts" (points). A wind reading
-- in brackets is ignored. Anything else (DNF, NM, empty) gives null: no record from it.
create function parse_mark(p_mark text) returns numeric
language plpgsql immutable as $$
declare
  m text := lower(coalesce(p_mark, ''));
  parts text[];
begin
  m := regexp_replace(m, '\(.*\)', '', 'g');
  m := replace(replace(m, ',', '.'), ' ', '');
  m := regexp_replace(m, '(m|pts|points)$', '');
  if m ~ '^\d+m\d+$' then
    return replace(m, 'm', '.')::numeric;
  elsif m ~ '^\d+:\d{1,2}:\d{1,2}(\.\d+)?$' then
    parts := string_to_array(m, ':');
    return parts[1]::numeric * 3600 + parts[2]::numeric * 60 + parts[3]::numeric;
  elsif m ~ '^\d+:\d{1,2}(\.\d+)?$' then
    parts := string_to_array(m, ':');
    return parts[1]::numeric * 60 + parts[2]::numeric;
  elsif m ~ '^\d+(\.\d+)?$' then
    return m::numeric;
  end if;
  return null;
end $$;

-- Races are won on time (lower is better); jumps, throws and combined events on distance, height
-- or points (higher is better). A race discipline names a distance in metres ("100 m",
-- "Relais mixte 4x400 m"), hurdles, steeplechase or walk.
create function lower_is_better(p_discipline text) returns boolean
language sql immutable as $$
  select p_discipline ~* '\d\s?m(\s|$)|haies|steeple|marche|relais'
$$;

-- True when the new mark beats the old one in this discipline; any mark beats no mark.
create function is_better_mark(p_discipline text, p_old numeric, p_new numeric) returns boolean
language sql immutable as $$
  select p_new is not null and (
    p_old is null
    or (lower_is_better(p_discipline) and p_new < p_old)
    or (not lower_is_better(p_discipline) and p_new > p_old))
$$;

-- After each official result line: the PR improves when beaten; the SB improves when beaten in
-- the same year, and restarts with a result of a later year. A corrected (worse) result does not
-- lower a record already set. Security definer: results are written by an admin, records by
-- nobody else.
create function update_records_from_result() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  value numeric := parse_mark(new.mark);
  e record;
begin
  if value is null then
    return new;
  end if;
  select ev.discipline, ev.starts_at::date as day, c.name as meeting into e
  from events ev join competitions c on c.id = ev.competition_id
  where ev.id = new.event_id;

  insert into athlete_records as r (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name)
  values (new.athlete_id, e.discipline, 'pr', new.mark, value, e.day, e.meeting)
  on conflict (athlete_id, discipline, kind) do update
    set mark = excluded.mark, mark_value = excluded.mark_value,
        record_date = excluded.record_date, meeting_name = excluded.meeting_name
    where is_better_mark(r.discipline, r.mark_value, excluded.mark_value);

  insert into athlete_records as r (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name)
  values (new.athlete_id, e.discipline, 'sb', new.mark, value, e.day, e.meeting)
  on conflict (athlete_id, discipline, kind) do update
    set mark = excluded.mark, mark_value = excluded.mark_value,
        record_date = excluded.record_date, meeting_name = excluded.meeting_name
    where extract(year from r.record_date) < extract(year from excluded.record_date)
       or (extract(year from r.record_date) = extract(year from excluded.record_date)
           and is_better_mark(r.discipline, r.mark_value, excluded.mark_value));
  return new;
end $$;

create trigger update_records_from_result
  after insert or update of mark on results
  for each row execute function update_records_from_result();

-- Backfill from every result already entered.
update results set mark = mark where mark is not null;
