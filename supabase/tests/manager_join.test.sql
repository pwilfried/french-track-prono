-- pgTAP: joining a Manager league (#420): a public one in one tap while places are left, a
-- private one with its code, never once the mercato is open. Rolled back at the end.
begin;
select plan(10);

-- Thirteen players: the creator, three who fill the league (4 players by default, #619), more.
insert into auth.users (id, email)
select ('adadad00-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'p' || n || '@example.test'
from generate_series(1, 13) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('adadad00-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Joueur ' || n, now()
from generate_series(1, 13) n;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"adadad00-0000-0000-0000-000000000001","role":"authenticated"}', true);
select create_manager_league('Ligue Publique', true);
select create_manager_league('Ligue Privee', false);

-- Their ids and codes, for the players who cannot read them yet.
reset role;
create temp table t_leagues as select id, name, invite_code from manager_leagues;
grant select on t_leagues to authenticated;
set local role authenticated;

select set_config('request.jwt.claims',
  '{"sub":"adadad00-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from list_public_manager_leagues()), 1,
  'a player sees the public league, not the private one');
select throws_ok(
  $$select join_public_manager_league((select id from t_leagues where name = 'Ligue Privee'))$$,
  'P0002', null, 'a private league is not joined in one tap');
select is(join_manager_league((select lower(invite_code) from t_leagues where name = 'Ligue Privee')),
  (select id from t_leagues where name = 'Ligue Privee'), 'it is joined with its code');
select is(join_manager_league('ZZZZZZ'), null, 'an unknown code joins nothing');

-- The public league fills up to its target, 4 players by default (#619).
do $$
begin
  for n in 2..4 loop
    perform set_config('request.jwt.claims', json_build_object(
      'sub', 'adadad00-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'),
      'role', 'authenticated')::text, true);
    perform join_public_manager_league((select id from t_leagues where name = 'Ligue Publique'));
  end loop;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"adadad00-0000-0000-0000-000000000013","role":"authenticated"}', true);
select is((select count(*)::int from list_public_manager_leagues()), 0, 'a full league leaves the list');
select throws_ok(
  $$select join_public_manager_league((select id from t_leagues where name = 'Ligue Publique'))$$,
  '54000', null, 'a 5th participant is refused');

select set_config('request.jwt.claims',
  '{"sub":"adadad00-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(join_public_manager_league((select id from t_leagues where name = 'Ligue Publique')),
  (select id from t_leagues where name = 'Ligue Publique'), 'a participant joining again changes nothing');
select is((select count(*)::int from manager_members m join t_leagues l on l.id = m.league_id
           where l.name = 'Ligue Publique'), 4, 'the league has 4 participants');

reset role;
update manager_leagues set mercato_opened_at = now() where name = 'Ligue Privee';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"adadad00-0000-0000-0000-000000000013","role":"authenticated"}', true);
select throws_ok(
  $$select join_manager_league((select invite_code from t_leagues where name = 'Ligue Privee'))$$,
  'FT015', null, 'nobody joins once the mercato is open');
select throws_ok($$insert into manager_members (league_id, user_id)
  select id, auth.uid() from t_leagues where name = 'Ligue Privee'$$, '42501', null,
  'nobody joins by writing the table');

select * from finish();
rollback;
