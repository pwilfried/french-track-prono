-- #573: a visitor (no account) reads the general ranking: the score lines of the players who are
-- not blocked, and the public face of their profile (pseudo, bib, club). Nothing private, no write.

grant execute on function is_blocked(uuid) to anon;

create policy anon_read on score_events for select to anon using (not is_blocked(user_id));

-- Column by column: a visitor never reads is_admin, blocked_at, age_confirmed_at…
revoke select on profiles from anon;
grant select (id, pseudo, bib_number, bib_color, club_id) on profiles to anon;
create policy anon_read on profiles for select to anon using (not is_blocked(id));
