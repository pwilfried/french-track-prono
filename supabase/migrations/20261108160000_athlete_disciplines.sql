-- Athletes and their disciplines (v0.8): the start list form proposes the athletes of the event's
-- discipline first, an athlete's main discipline before the others. Filled from the start lists:
-- every entry tells a discipline the athlete runs. Everybody reads; nobody writes through the API.
create table athlete_disciplines (
  athlete_id uuid not null references athletes(id) on delete cascade,
  discipline text not null,
  is_primary boolean not null default false,
  primary key (athlete_id, discipline)
);
create index on athlete_disciplines (discipline, is_primary desc);

alter table athlete_disciplines enable row level security;
create policy read_all on athlete_disciplines for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on athlete_disciplines from anon, authenticated;

-- A new entry adds the discipline to the athlete; the first discipline known is the main one.
create function add_athlete_discipline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into athlete_disciplines (athlete_id, discipline, is_primary)
  select new.athlete_id, e.discipline,
         not exists (select 1 from athlete_disciplines d where d.athlete_id = new.athlete_id)
  from events e where e.id = new.event_id
  on conflict (athlete_id, discipline) do nothing;
  return new;
end $$;

create trigger add_athlete_discipline
  after insert on entries
  for each row execute function add_athlete_discipline();

-- Backfill: every discipline of the existing start lists; the main one is the most entered.
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select athlete_id, discipline,
       row_number() over (partition by athlete_id order by count(*) desc, discipline) = 1
from entries en join events e on e.id = en.event_id
group by athlete_id, discipline
on conflict (athlete_id, discipline) do nothing;
