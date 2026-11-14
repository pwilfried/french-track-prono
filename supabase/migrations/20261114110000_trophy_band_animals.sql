-- One name per animal (#682): the trophies use the animals of the band (src/domain/band.ts,
-- #768) instead of a second list of their own. Same animals, same statuettes; only the codes
-- change.

alter table trophies drop constraint trophies_animal_check;

update trophies set animal = case animal
  when 'cheetah'  then 'guepard'
  when 'hare'     then 'lievre'
  when 'kangaroo' then 'kangourou'
  when 'cat'      then 'chat'
  when 'bear'     then 'ours'
  when 'fox'      then 'renard'
  else animal
end;

alter table trophies add constraint trophies_animal_check
  check (animal in ('lievre', 'guepard', 'impala', 'kangourou', 'chat', 'ours', 'renard'));
