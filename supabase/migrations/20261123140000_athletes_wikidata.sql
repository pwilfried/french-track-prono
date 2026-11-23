-- #1191: athletes linked to their Wikidata item, and where each record comes from (step 1 of
-- docs/decisions/athletes-wikidata.md, section 9).
--   * athletes: the item (`Q…`), the birth date (not shown: it tells namesakes apart in the
--     back-office), the Wikipedia link and the state of the link (unknown, linked, to_review,
--     absent);
--   * athlete_wikidata_candidates: the items the admin chooses from, for an athlete to_review;
--   * athlete_records.source: admin, results, wikidata, or null for an existing row we cannot
--     trace. No row is deleted here (decision of the owner, 23 Nov 2026).
-- Every write goes through the admin_ functions below. The weekly script calls the
-- admin_wikidata_ ones with the service_role key, which is_admin() counts as an admin.
-- Error codes: 42501 not an admin, 22023 invalid item, 23505 item already linked to another athlete.

alter table athletes
  add column wikidata_id text unique check (wikidata_id ~ '^Q[1-9][0-9]*$'),
  add column birth_date date check (birth_date between date '1900-01-01' and date '2100-01-01'),
  add column wikipedia_url text
    check (char_length(wikipedia_url) <= 500 and wikipedia_url ~ '^https://[a-z-]+\.wikipedia\.org/wiki/.+'),
  add column wikidata_status text not null default 'unknown'
    check (wikidata_status in ('unknown', 'linked', 'to_review', 'absent')),
  add constraint athletes_wikidata_linked check ((wikidata_status = 'linked') = (wikidata_id is not null));

-- The candidates of an athlete to_review, replaced at each run of the script. Read by the admin only.
create table athlete_wikidata_candidates (
  athlete_id   uuid not null references athletes(id) on delete cascade,
  wikidata_id  text not null check (wikidata_id ~ '^Q[1-9][0-9]*$'),
  label        text not null check (char_length(label) between 1 and 200),
  description  text check (char_length(description) <= 300),
  birth_date   date,
  country_code char(3),
  primary key (athlete_id, wikidata_id)
);

alter table athlete_wikidata_candidates enable row level security;
create policy admin_read on athlete_wikidata_candidates for select to authenticated using (is_admin());
revoke all on athlete_wikidata_candidates from anon;
revoke insert, update, delete, truncate on athlete_wikidata_candidates from authenticated;

-- Where a record comes from. The existing rows: verified ones were typed by the admin; an
-- unverified one whose mark is one of our results comes from them; the rest stays null (kept).
alter table athlete_records
  add column source text check (source in ('admin', 'results', 'wikidata'));

update athlete_records set source = 'admin' where verified;
update athlete_records r set source = 'results'
where not r.verified
  and exists (select 1 from results res join events ev on ev.id = res.event_id
              where res.athlete_id = r.athlete_id and ev.discipline = r.discipline
                and parse_mark(res.mark) = r.mark_value);

-- Same rule as before (v0.8); the row it writes now says it comes from the results.
create or replace function update_records_from_result() returns trigger
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

  insert into athlete_records as r (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name, source)
  values (new.athlete_id, e.discipline, 'pr', new.mark, value, e.day, e.meeting, 'results')
  on conflict (athlete_id, discipline, kind) do update
    set mark = excluded.mark, mark_value = excluded.mark_value,
        record_date = excluded.record_date, meeting_name = excluded.meeting_name, source = 'results'
    where is_better_mark(r.discipline, r.mark_value, excluded.mark_value);

  insert into athlete_records as r (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name, source)
  values (new.athlete_id, e.discipline, 'sb', new.mark, value, e.day, e.meeting, 'results')
  on conflict (athlete_id, discipline, kind) do update
    set mark = excluded.mark, mark_value = excluded.mark_value,
        record_date = excluded.record_date, meeting_name = excluded.meeting_name, source = 'results'
    where extract(year from r.record_date) < extract(year from excluded.record_date)
       or (extract(year from r.record_date) = extract(year from excluded.record_date)
           and is_better_mark(r.discipline, r.mark_value, excluded.mark_value));
  return new;
end $$;

-- Same as before, the row says it was typed by the admin.
create or replace function admin_set_athlete_record(
  p_athlete uuid, p_discipline text, p_kind text, p_mark text, p_value numeric, p_date date
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_kind not in ('pr', 'sb') then
    raise exception 'only PR and SB are entered here' using errcode = '22023';
  end if;
  if p_mark is null or p_mark = '' then
    delete from athlete_records where athlete_id = p_athlete and discipline = p_discipline and kind = p_kind;
  else
    insert into athlete_records (athlete_id, discipline, kind, mark, mark_value, record_date, verified, source)
    values (p_athlete, p_discipline, p_kind, p_mark, p_value, p_date, true, 'admin')
    on conflict (athlete_id, discipline, kind) do update
      set mark = excluded.mark, mark_value = excluded.mark_value,
          record_date = excluded.record_date, meeting_name = null, verified = true, source = 'admin';
  end if;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'discipline', p_discipline, 'kind', p_kind, 'mark', p_mark));
end $$;

-- What came from an item no longer linked: its identity, its candidates, its unverified PBs.
create function private.forget_wikidata(p_athlete uuid, p_status text) returns void
language sql security definer set search_path = public as $$
  update athletes set wikidata_id = null, birth_date = null, wikipedia_url = null, wikidata_status = p_status
  where id = p_athlete;
  delete from athlete_wikidata_candidates where athlete_id = p_athlete;
  delete from athlete_records where athlete_id = p_athlete and source = 'wikidata' and not verified;
$$;
revoke execute on function private.forget_wikidata(uuid, text) from public, anon, authenticated;

-- The admin links an athlete to an item (chosen among the candidates, or typed).
create function admin_link_athlete_wikidata(p_athlete uuid, p_wikidata_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_wikidata_id is null or p_wikidata_id !~ '^Q[1-9][0-9]*$' then
    raise exception 'invalid Wikidata item' using errcode = '22023';
  end if;
  if exists (select 1 from athletes where id = p_athlete and wikidata_id is distinct from p_wikidata_id) then
    perform private.forget_wikidata(p_athlete, 'unknown');
  end if;
  update athletes set wikidata_id = p_wikidata_id, wikidata_status = 'linked' where id = p_athlete;
  delete from athlete_wikidata_candidates where athlete_id = p_athlete;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'wikidata', p_wikidata_id));
end $$;

-- The admin undoes the link: the athlete is searched again at the next run.
create function admin_unlink_athlete_wikidata(p_athlete uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  perform private.forget_wikidata(p_athlete, 'unknown');
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'wikidata', null));
end $$;

-- The admin says the athlete has no item: never searched again.
create function admin_mark_athlete_absent_from_wikidata(p_athlete uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  perform private.forget_wikidata(p_athlete, 'absent');
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'wikidata', 'absent'));
end $$;

-- The script: a sure link (section 6, rule 4). Only an athlete not linked yet and not marked
-- absent: a link, once set, changes only by the admin. True when the link is written.
create function admin_wikidata_save_link(p_athlete uuid, p_wikidata_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_wikidata_id is null or p_wikidata_id !~ '^Q[1-9][0-9]*$' then
    raise exception 'invalid Wikidata item' using errcode = '22023';
  end if;
  update athletes set wikidata_id = p_wikidata_id, wikidata_status = 'linked'
  where id = p_athlete and wikidata_status in ('unknown', 'to_review');
  if not found then
    return false;
  end if;
  delete from athlete_wikidata_candidates where athlete_id = p_athlete;
  return true;
end $$;

-- The script: the candidates of an athlete it cannot link alone, in place of the previous ones
-- ([{wikidata_id, label, description, birth_date, country_code}], possibly empty). True when
-- they are written (the athlete is then to_review).
create function admin_wikidata_save_candidates(p_athlete uuid, p_candidates jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  update athletes set wikidata_status = 'to_review'
  where id = p_athlete and wikidata_status in ('unknown', 'to_review');
  if not found then
    return false;
  end if;
  delete from athlete_wikidata_candidates where athlete_id = p_athlete;
  insert into athlete_wikidata_candidates (athlete_id, wikidata_id, label, description, birth_date, country_code)
  select p_athlete, c ->> 'wikidata_id', c ->> 'label', nullif(c ->> 'description', ''),
         (nullif(c ->> 'birth_date', ''))::date, upper(nullif(c ->> 'country_code', ''))
  from jsonb_array_elements(coalesce(p_candidates, '[]')) as c;
  return true;
end $$;

-- The script: the identity read on the item the athlete is linked to. True when written.
create function admin_wikidata_save_identity(
  p_athlete uuid, p_wikidata_id text, p_birth_date date, p_wikipedia_url text
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  update athletes set birth_date = p_birth_date, wikipedia_url = nullif(p_wikipedia_url, '')
  where id = p_athlete and wikidata_id = p_wikidata_id;
  return found;
end $$;

-- The script: a PB read on the item the athlete is linked to. It replaces an unverified PR of the
-- same discipline (unless it comes from our results and is better), never a verified one; with no
-- PR, it is added. True when written.
create function admin_wikidata_save_record(
  p_athlete uuid, p_wikidata_id text, p_discipline text, p_mark text, p_value numeric,
  p_date date, p_meeting text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  written int;
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if not exists (select 1 from athletes where id = p_athlete and wikidata_id = p_wikidata_id) then
    return false;
  end if;
  insert into athlete_records as r
    (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name, verified, source)
  values (p_athlete, p_discipline, 'pr', p_mark, p_value, p_date, p_meeting, false, 'wikidata')
  on conflict (athlete_id, discipline, kind) do update
    set mark = excluded.mark, mark_value = excluded.mark_value, record_date = excluded.record_date,
        meeting_name = excluded.meeting_name, source = 'wikidata'
    where not r.verified
      and (r.source is distinct from 'results'
           or is_better_mark(r.discipline, r.mark_value, excluded.mark_value));
  get diagnostics written = row_count;
  return written > 0;
end $$;

revoke execute on function admin_link_athlete_wikidata(uuid, text) from public, anon;
revoke execute on function admin_unlink_athlete_wikidata(uuid) from public, anon;
revoke execute on function admin_mark_athlete_absent_from_wikidata(uuid) from public, anon;
revoke execute on function admin_wikidata_save_link(uuid, text) from public, anon;
revoke execute on function admin_wikidata_save_candidates(uuid, jsonb) from public, anon;
revoke execute on function admin_wikidata_save_identity(uuid, text, date, text) from public, anon;
revoke execute on function admin_wikidata_save_record(uuid, text, text, text, numeric, date, text) from public, anon;
grant execute on function admin_link_athlete_wikidata(uuid, text) to authenticated, service_role;
grant execute on function admin_unlink_athlete_wikidata(uuid) to authenticated, service_role;
grant execute on function admin_mark_athlete_absent_from_wikidata(uuid) to authenticated, service_role;
grant execute on function admin_wikidata_save_link(uuid, text) to authenticated, service_role;
grant execute on function admin_wikidata_save_candidates(uuid, jsonb) to authenticated, service_role;
grant execute on function admin_wikidata_save_identity(uuid, text, date, text) to authenticated, service_role;
grant execute on function admin_wikidata_save_record(uuid, text, text, text, numeric, date, text) to authenticated, service_role;
