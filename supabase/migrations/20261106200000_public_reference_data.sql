-- Reference data (competitions, events, athletes, entries, results) is public sports facts.
-- v0.1 shows it before any account exists, so anonymous visitors must be able to read it.
-- Players' data (profiles, predictions, leagues, scores) stays private to signed-in players.

drop policy read_all on competitions;
drop policy read_all on athletes;
drop policy read_all on events;
drop policy read_all on entries;
drop policy read_all on results;

create policy read_all on competitions for select to anon, authenticated using (true);
create policy read_all on athletes     for select to anon, authenticated using (true);
create policy read_all on events       for select to anon, authenticated using (true);
create policy read_all on entries      for select to anon, authenticated using (true);
create policy read_all on results      for select to anon, authenticated using (true);
