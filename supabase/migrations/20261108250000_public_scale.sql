-- The « Comment jouer » page (v0.9, #263) shows the scale to visitors too: the values of
-- scoring_rules are public information.
create policy read_anon on scoring_rules for select to anon using (true);
