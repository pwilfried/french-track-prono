-- =====================================================================
-- French Track Prono — données de test : World Athletics Ultimate Championship
-- Budapest, 11-13 septembre 2026 (1re édition)
-- A exécuter APRES 01_schema.sql
--
-- Source des résultats : NBC Sports (finales). A recouper avec World Athletics.
--  * Seuls les podiums (rang 1 à 3) + les finalistes français sont chargés.
--    Les listes de départ complètes seront à importer pour le vrai jeu.
--  * Les horaires sont des PLACEHOLDERS (19:00 heure de Budapest, le jour
--    de l'épreuve quand il est connu). Jours à confirmer : javelot F/H,
--    longueur F/H, triple saut F, marteau H, hauteur H.
--  * ⚠ Saut en longueur F : la source donne un ordre incohérent avec les
--    marques (2e = 6.59 m, 3e = 6.77 m). A vérifier avant de s'en servir.
--  * Hauteur F : égalité à la 3e place (Patterson / Topic, 1.91 m).
-- =====================================================================

begin;

insert into competitions (slug, name, city, country_code, starts_on, ends_on, level, status)
values ('ultimate-championship-2026', 'World Athletics Ultimate Championship', 'Budapest', 'HUN',
        '2026-09-11', '2026-09-13', 'championnat', 'finished')
on conflict (slug) do nothing;

-- ---------- Epreuves ----------
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, is_featured, status)
select c.id, v.slug, v.discipline, v.gender, v.starts_at, v.starts_at - interval '5 minutes', v.is_featured, 'finished'
from competitions c, (values
  ('f-100m', '100 m', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', true),
  ('f-100m-hurdles', '100 m haies', 'F', (timestamp '2026-09-11 19:00') at time zone 'Europe/Budapest', false),
  ('f-200m', '200 m', 'F', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false),
  ('f-400m', '400 m', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('f-400m-hurdles', '400 m haies', 'F', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false),
  ('f-800m', '800 m', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('f-1500m', '1500 m', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('f-5000m', '5000 m', 'F', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false),
  ('f-high-jump', 'Saut en hauteur', 'F', (timestamp '2026-09-11 19:00') at time zone 'Europe/Budapest', false),
  ('f-javelin', 'Javelot', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('f-long-jump', 'Saut en longueur', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('f-pole-vault', 'Saut à la perche', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('f-triple-jump', 'Triple saut', 'F', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('m-100m', '100 m', 'M', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', true),
  ('m-110m-hurdles', '110 m haies', 'M', (timestamp '2026-09-11 19:00') at time zone 'Europe/Budapest', false),
  ('m-200m', '200 m', 'M', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false),
  ('m-400m', '400 m', 'M', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('m-400m-hurdles', '400 m haies', 'M', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', true),
  ('m-800m', '800 m', 'M', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false),
  ('m-1500m', '1500 m', 'M', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false),
  ('m-5000m', '5000 m', 'M', (timestamp '2026-09-11 19:00') at time zone 'Europe/Budapest', true),
  ('m-hammer', 'Lancer du marteau', 'M', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('m-high-jump', 'Saut en hauteur', 'M', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('m-javelin', 'Javelot', 'M', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('m-long-jump', 'Saut en longueur', 'M', (timestamp '2026-09-12 19:00') at time zone 'Europe/Budapest', false),
  ('m-pole-vault', 'Saut à la perche', 'M', (timestamp '2026-09-11 19:00') at time zone 'Europe/Budapest', true),
  ('x-4x100m', 'Relais mixte 4x100 m', 'X', (timestamp '2026-09-11 19:00') at time zone 'Europe/Budapest', false),
  ('x-4x400m', 'Relais mixte 4x400 m', 'X', (timestamp '2026-09-13 19:00') at time zone 'Europe/Budapest', false)
) as v(slug, discipline, gender, starts_at, is_featured)
where c.slug = 'ultimate-championship-2026'
on conflict (competition_id, slug) do nothing;

-- ---------- Athletes et equipes ----------
insert into athletes (slug, name, country_code, gender, kind) values
  ('melissa-jefferson-wooden', 'Melissa Jefferson-Wooden', 'USA', 'F', 'athlete'),
  ('julien-alfred', 'Julien Alfred', 'LCA', 'F', 'athlete'),
  ('sha-carri-richardson', 'Sha''Carri Richardson', 'USA', 'F', 'athlete'),
  ('masai-russell', 'Masai Russell', 'USA', 'F', 'athlete'),
  ('tobi-amusan', 'Tobi Amusan', 'NGR', 'F', 'athlete'),
  ('nadine-visser', 'Nadine Visser', 'NED', 'F', 'athlete'),
  ('gabby-thomas', 'Gabby Thomas', 'USA', 'F', 'athlete'),
  ('kayla-white', 'Kayla White', 'USA', 'F', 'athlete'),
  ('marileidy-paulino', 'Marileidy Paulino', 'DOM', 'F', 'athlete'),
  ('henriette-jaeger', 'Henriette Jaeger', 'NOR', 'F', 'athlete'),
  ('nickisha-pryce', 'Nickisha Pryce', 'JAM', 'F', 'athlete'),
  ('jasmine-jones', 'Jasmine Jones', 'USA', 'F', 'athlete'),
  ('emma-zapletalova', 'Emma Zapletalova', 'SVK', 'F', 'athlete'),
  ('anna-cockrell', 'Anna Cockrell', 'USA', 'F', 'athlete'),
  ('audrey-werro', 'Audrey Werro', 'SUI', 'F', 'athlete'),
  ('keely-hodgkinson', 'Keely Hodgkinson', 'GBR', 'F', 'athlete'),
  ('femke-broeders-bol', 'Femke Broeders-Bol', 'NED', 'F', 'athlete'),
  ('klaudia-kazimierska', 'Klaudia Kazimierska', 'POL', 'F', 'athlete'),
  ('georgia-hunter-bell', 'Georgia Hunter Bell', 'GBR', 'F', 'athlete'),
  ('nikki-hiltz', 'Nikki Hiltz', 'USA', 'F', 'athlete'),
  ('agathe-guillemot', 'Agathe Guillemot', 'FRA', 'F', 'athlete'),
  ('likina-amebaw', 'Likina Amebaw', 'ETH', 'F', 'athlete'),
  ('jessica-hull', 'Jessica Hull', 'AUS', 'F', 'athlete'),
  ('fantaye-belayneh', 'Fantaye Belayneh', 'ETH', 'F', 'athlete'),
  ('yaroslava-mahuchikh', 'Yaroslava Mahuchikh', 'UKR', 'F', 'athlete'),
  ('nicola-olyslagers', 'Nicola Olyslagers', 'AUS', 'F', 'athlete'),
  ('eleanor-patterson', 'Eleanor Patterson', 'AUS', 'F', 'athlete'),
  ('angelina-topic', 'Angelina Topic', 'SRB', 'F', 'athlete'),
  ('haruka-kitaguchi', 'Haruka Kitaguchi', 'JPN', 'F', 'athlete'),
  ('yan-ziyi', 'Yan Ziyi', 'CHN', 'F', 'athlete'),
  ('flor-denis-ruiz-hurtado', 'Flor Denis Ruiz Hurtado', 'COL', 'F', 'athlete'),
  ('larissa-iapichino', 'Larissa Iapichino', 'ITA', 'F', 'athlete'),
  ('jazmin-sawyers', 'Jazmin Sawyers', 'GBR', 'F', 'athlete'),
  ('alyssa-jones', 'Alyssa Jones', 'USA', 'F', 'athlete'),
  ('hilary-kpatcha', 'Hilary Kpatcha', 'FRA', 'F', 'athlete'),
  ('sandi-morris', 'Sandi Morris', 'USA', 'F', 'athlete'),
  ('hana-moll', 'Hana Moll', 'USA', 'F', 'athlete'),
  ('angelica-moser', 'Angelica Moser', 'SUI', 'F', 'athlete'),
  ('saly-sarr', 'Saly Sarr', 'SEN', 'F', 'athlete'),
  ('davisleydi-velazco', 'Davisleydi Velazco', 'CUB', 'F', 'athlete'),
  ('leyanis-perez-hernandez', 'Leyanis Perez Hernandez', 'CUB', 'F', 'athlete'),
  ('kenny-bednarek', 'Kenny Bednarek', 'USA', 'M', 'athlete'),
  ('oblique-seville', 'Oblique Seville', 'JAM', 'M', 'athlete'),
  ('ronnie-baker', 'Ronnie Baker', 'USA', 'M', 'athlete'),
  ('ja-kobe-tharp', 'Ja''Kobe Tharp', 'USA', 'M', 'athlete'),
  ('cordell-tinch', 'Cordell Tinch', 'USA', 'M', 'athlete'),
  ('bradley-franklin', 'Bradley Franklin', 'USA', 'M', 'athlete'),
  ('letsile-tebogo', 'Letsile Tebogo', 'BOT', 'M', 'athlete'),
  ('courtney-lindsey', 'Courtney Lindsey', 'USA', 'M', 'athlete'),
  ('collen-kebinatshipi', 'Collen Kebinatshipi', 'BOT', 'M', 'athlete'),
  ('rai-benjamin', 'Rai Benjamin', 'USA', 'M', 'athlete'),
  ('jereem-richards', 'Jereem Richards', 'TTO', 'M', 'athlete'),
  ('alison-dos-santos', 'Alison dos Santos', 'BRA', 'M', 'athlete'),
  ('karsten-warholm', 'Karsten Warholm', 'NOR', 'M', 'athlete'),
  ('djamel-sedjati', 'Djamel Sedjati', 'ALG', 'M', 'athlete'),
  ('marco-arop', 'Marco Arop', 'CAN', 'M', 'athlete'),
  ('emmanuel-wanyonyi', 'Emmanuel Wanyonyi', 'KEN', 'M', 'athlete'),
  ('yanis-meziane', 'Yanis Meziane', 'FRA', 'M', 'athlete'),
  ('josh-kerr', 'Josh Kerr', 'GBR', 'M', 'athlete'),
  ('cameron-myers', 'Cameron Myers', 'AUS', 'M', 'athlete'),
  ('hobbs-kessler', 'Hobbs Kessler', 'USA', 'M', 'athlete'),
  ('azeddine-habz', 'Azeddine Habz', 'FRA', 'M', 'athlete'),
  ('jakob-ingebrigtsen', 'Jakob Ingebrigtsen', 'NOR', 'M', 'athlete'),
  ('cole-hocker', 'Cole Hocker', 'USA', 'M', 'athlete'),
  ('parker-wolfe', 'Parker Wolfe', 'USA', 'M', 'athlete'),
  ('merlin-hummel', 'Merlin Hummel', 'GER', 'M', 'athlete'),
  ('bence-halasz', 'Bence Halasz', 'HUN', 'M', 'athlete'),
  ('mykhaylo-kokhan', 'Mykhaylo Kokhan', 'UKR', 'M', 'athlete'),
  ('yann-chaussinand', 'Yann Chaussinand', 'FRA', 'M', 'athlete'),
  ('gianmarco-tamberi', 'Gianmarco Tamberi', 'ITA', 'M', 'athlete'),
  ('juvaughn-harrison', 'JuVaughn Harrison', 'USA', 'M', 'athlete'),
  ('erick-portillo', 'Erick Portillo', 'MEX', 'M', 'athlete'),
  ('rumesh-pathirage', 'Rumesh Pathirage', 'SRI', 'M', 'athlete'),
  ('anderson-peters', 'Anderson Peters', 'GRN', 'M', 'athlete'),
  ('julian-weber', 'Julian Weber', 'GER', 'M', 'athlete'),
  ('miltiadis-tentoglou', 'Miltiadis Tentoglou', 'GRE', 'M', 'athlete'),
  ('bozhidar-saraboyukov', 'Bozhidar Saraboyukov', 'BUL', 'M', 'athlete'),
  ('simon-ehammer', 'Simon Ehammer', 'SUI', 'M', 'athlete'),
  ('mondo-duplantis', 'Mondo Duplantis', 'SWE', 'M', 'athlete'),
  ('manolo-karalis', 'Manolo Karalis', 'GRE', 'M', 'athlete'),
  ('sondre-guttormsen', 'Sondre Guttormsen', 'NOR', 'M', 'athlete'),
  ('baptiste-thiery', 'Baptiste Thiery', 'FRA', 'M', 'athlete'),
  ('team-usa', 'États-Unis', 'USA', 'X', 'team'),
  ('team-jam', 'Jamaïque', 'JAM', 'X', 'team'),
  ('team-gbr', 'Grande-Bretagne', 'GBR', 'X', 'team'),
  ('team-ned', 'Pays-Bas', 'NED', 'X', 'team')
on conflict (slug) do nothing;

-- ---------- Resultats (table temporaire) ----------
create temp table _seed_results (event_slug text, athlete_slug text, rank int, mark text) on commit drop;
insert into _seed_results values
  ('f-100m', 'melissa-jefferson-wooden', 1, '10.62'),
  ('f-100m', 'julien-alfred', 2, '10.74'),
  ('f-100m', 'sha-carri-richardson', 3, '10.76'),
  ('f-100m-hurdles', 'masai-russell', 1, '12.22'),
  ('f-100m-hurdles', 'tobi-amusan', 2, '12.34'),
  ('f-100m-hurdles', 'nadine-visser', 3, '12.39'),
  ('f-200m', 'melissa-jefferson-wooden', 1, '21.47'),
  ('f-200m', 'gabby-thomas', 2, '21.77'),
  ('f-200m', 'kayla-white', 3, '21.93'),
  ('f-400m', 'marileidy-paulino', 1, '49.07'),
  ('f-400m', 'henriette-jaeger', 2, '49.28'),
  ('f-400m', 'nickisha-pryce', 3, '49.56'),
  ('f-400m-hurdles', 'jasmine-jones', 1, '52.45'),
  ('f-400m-hurdles', 'emma-zapletalova', 2, '52.68'),
  ('f-400m-hurdles', 'anna-cockrell', 3, '53.09'),
  ('f-800m', 'audrey-werro', 1, '1:55.88'),
  ('f-800m', 'keely-hodgkinson', 2, '1:56.26'),
  ('f-800m', 'femke-broeders-bol', 3, '1:56.74'),
  ('f-1500m', 'klaudia-kazimierska', 1, '3:57.55'),
  ('f-1500m', 'georgia-hunter-bell', 2, '3:57.72'),
  ('f-1500m', 'nikki-hiltz', 3, '3:58.16'),
  ('f-1500m', 'agathe-guillemot', 8, '3:59.40'),
  ('f-5000m', 'likina-amebaw', 1, '14:30.36'),
  ('f-5000m', 'jessica-hull', 2, '14:32.39'),
  ('f-5000m', 'fantaye-belayneh', 3, '14:32.62'),
  ('f-high-jump', 'yaroslava-mahuchikh', 1, '1.99'),
  ('f-high-jump', 'nicola-olyslagers', 2, '1.95'),
  ('f-high-jump', 'eleanor-patterson', 3, '1.91'),
  ('f-high-jump', 'angelina-topic', 3, '1.91'),
  ('f-javelin', 'haruka-kitaguchi', 1, '69.92'),
  ('f-javelin', 'yan-ziyi', 2, '68.05'),
  ('f-javelin', 'flor-denis-ruiz-hurtado', 3, '64.84'),
  ('f-long-jump', 'larissa-iapichino', 1, '6.90'),
  ('f-long-jump', 'jazmin-sawyers', 2, '6.59'),
  ('f-long-jump', 'alyssa-jones', 3, '6.77'),
  ('f-long-jump', 'hilary-kpatcha', 4, '6.73'),
  ('f-pole-vault', 'sandi-morris', 1, '4.90'),
  ('f-pole-vault', 'hana-moll', 2, '4.90'),
  ('f-pole-vault', 'angelica-moser', 3, '4.85'),
  ('f-triple-jump', 'saly-sarr', 1, '15.06'),
  ('f-triple-jump', 'davisleydi-velazco', 2, '15.04'),
  ('f-triple-jump', 'leyanis-perez-hernandez', 3, '14.90'),
  ('m-100m', 'kenny-bednarek', 1, '9.85'),
  ('m-100m', 'oblique-seville', 2, '9.90'),
  ('m-100m', 'ronnie-baker', 3, '9.93'),
  ('m-110m-hurdles', 'ja-kobe-tharp', 1, '12.94'),
  ('m-110m-hurdles', 'cordell-tinch', 2, '12.95'),
  ('m-110m-hurdles', 'bradley-franklin', 3, '13.01'),
  ('m-200m', 'kenny-bednarek', 1, '19.52'),
  ('m-200m', 'letsile-tebogo', 2, '19.76'),
  ('m-200m', 'courtney-lindsey', 3, '19.79'),
  ('m-400m', 'collen-kebinatshipi', 1, '43.39'),
  ('m-400m', 'rai-benjamin', 2, '44.15'),
  ('m-400m', 'jereem-richards', 3, '44.23'),
  ('m-400m-hurdles', 'alison-dos-santos', 1, '45.98'),
  ('m-400m-hurdles', 'rai-benjamin', 2, '46.40'),
  ('m-400m-hurdles', 'karsten-warholm', 3, '46.78'),
  ('m-800m', 'djamel-sedjati', 1, '1:41.91'),
  ('m-800m', 'marco-arop', 2, '1:42.28'),
  ('m-800m', 'emmanuel-wanyonyi', 3, '1:42.44'),
  ('m-800m', 'yanis-meziane', 7, '1:42.78'),
  ('m-1500m', 'josh-kerr', 1, '3:29.35'),
  ('m-1500m', 'cameron-myers', 2, '3:29.68'),
  ('m-1500m', 'hobbs-kessler', 3, '3:30.73'),
  ('m-1500m', 'azeddine-habz', 6, '3:30.96'),
  ('m-5000m', 'jakob-ingebrigtsen', 1, '12:59.24'),
  ('m-5000m', 'cole-hocker', 2, '13:00.05'),
  ('m-5000m', 'parker-wolfe', 3, '13:00.13'),
  ('m-hammer', 'merlin-hummel', 1, '81.46'),
  ('m-hammer', 'bence-halasz', 2, '80.30'),
  ('m-hammer', 'mykhaylo-kokhan', 3, '78.90'),
  ('m-hammer', 'yann-chaussinand', 4, '78.36'),
  ('m-high-jump', 'gianmarco-tamberi', 1, '2.37'),
  ('m-high-jump', 'juvaughn-harrison', 2, '2.30'),
  ('m-high-jump', 'erick-portillo', 3, '2.26'),
  ('m-javelin', 'rumesh-pathirage', 1, '91.09'),
  ('m-javelin', 'anderson-peters', 2, '86.18'),
  ('m-javelin', 'julian-weber', 3, '85.89'),
  ('m-long-jump', 'miltiadis-tentoglou', 1, '8.35'),
  ('m-long-jump', 'bozhidar-saraboyukov', 2, '8.34'),
  ('m-long-jump', 'simon-ehammer', 3, '8.07'),
  ('m-pole-vault', 'mondo-duplantis', 1, '6.20'),
  ('m-pole-vault', 'manolo-karalis', 2, '6.15'),
  ('m-pole-vault', 'sondre-guttormsen', 3, '5.95'),
  ('m-pole-vault', 'baptiste-thiery', 6, '5.80'),
  ('x-4x100m', 'team-usa', 1, '39.64'),
  ('x-4x100m', 'team-jam', 2, '39.72'),
  ('x-4x100m', 'team-gbr', 3, '40.26'),
  ('x-4x400m', 'team-usa', 1, '3:08.32'),
  ('x-4x400m', 'team-gbr', 2, '3:09.40'),
  ('x-4x400m', 'team-ned', 3, '3:09.57');

-- Les engagés de la démo = les athlètes présents dans les résultats
insert into entries (event_id, athlete_id)
select e.id, a.id
from _seed_results s
join competitions c on c.slug = 'ultimate-championship-2026'
join events e on e.competition_id = c.id and e.slug = s.event_slug
join athletes a on a.slug = s.athlete_slug
on conflict do nothing;

insert into results (event_id, athlete_id, rank, mark)
select e.id, a.id, s.rank, s.mark
from _seed_results s
join competitions c on c.slug = 'ultimate-championship-2026'
join events e on e.competition_id = c.id and e.slug = s.event_slug
join athletes a on a.slug = s.athlete_slug
on conflict do nothing;

commit;
