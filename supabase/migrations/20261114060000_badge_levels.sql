-- #821: badges are won in bronze, silver then gold over the season, and each family of events has
-- its own badge (docs/decisions/badges-et-trophees.md). The app counts the badges; this table
-- keeps the highest level a player has won and been shown, so a badge is never lost and its
-- celebration is shown once. A level only goes up; no one can lower or remove it.

-- The badge codes of the app (src/domain/badges.ts). The four first codes of the init migration
-- become the badges that replaced them.
insert into badges (code, label, description, emoji) values
  ('chasseur', 'Chasseur',         'Vainqueurs trouvés',                              '🎯'),
  ('flair',    'Flair',            'Coups de flair',                                  '🦊'),
  ('serie',    'Série',            'Meilleure suite d''épreuves avec des points',     '🔥'),
  ('bleus',    'Bleus',            'Vainqueurs français trouvés',                     '🇫🇷'),
  ('fidele',   'Fidèle',           'Journées dont toutes les épreuves sont pronostiquées', '📅'),
  ('foudre',   'Foudre',           'Points gagnés en sprint',                         '🐆'),
  ('haies',    'Haies hautes',     'Points gagnés en haies',                          '🦌'),
  ('train',    'Train d''enfer',   'Points gagnés en demi-fond et fond',              '🐇'),
  ('bond',     'Grand bond',       'Points gagnés en longueur et triple saut',        '🦘'),
  ('envol',    'Envol',            'Points gagnés en perche et hauteur',              '🐈'),
  ('force',    'Force tranquille', 'Points gagnés aux lancers',                       '🐻'),
  ('touche',   'Touche-à-tout',    'Points gagnés aux épreuves combinées',            '🦊')
on conflict (code) do nothing;
update badges set description = 'Podiums parfaits (les trois dans l''ordre)'
  where code = 'nostradamus';

update user_badges set badge_code = case badge_code
    when 'outsider-hunter' then 'flair'
    when 'flamme' then 'serie'
    when 'fan-des-bleus' then 'bleus'
  end
  where badge_code in ('outsider-hunter', 'flamme', 'fan-des-bleus');
delete from badges where code in ('outsider-hunter', 'flamme', 'fan-des-bleus');

-- Only raise_my_badge_levels writes: no one lowers or removes a level.
revoke insert, update, delete, truncate on badges, user_badges from anon, authenticated;

-- The badges won before the levels become bronze: nothing is lost.
alter table user_badges
  add column level text not null default 'bronze'
    check (level in ('bronze', 'silver', 'gold'));

-- The signed-in player raises their own levels: [{"badge": "chasseur", "level": "silver"}].
-- A level lower than the stored one is ignored.
create function raise_my_badge_levels(p_levels jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into user_badges as ub (user_id, badge_code, level)
  select auth.uid(), x.badge, x.level
  from jsonb_to_recordset(p_levels) as x(badge text, level text)
  on conflict (user_id, badge_code) do update
    set level = case
      when array_position(array['bronze', 'silver', 'gold'], excluded.level)
         > array_position(array['bronze', 'silver', 'gold'], ub.level)
      then excluded.level else ub.level end;
end $$;
revoke execute on function raise_my_badge_levels(jsonb) from public, anon;
grant execute on function raise_my_badge_levels(jsonb) to authenticated;
