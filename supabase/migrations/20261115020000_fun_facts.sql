-- « Le saviez-vous ? » (#766): a short athletics fact at the top of the player's home.
-- The admin manages the bank from the back-office (add, edit, disable, delete) and switches the
-- card on or off; a player reads the active facts and the switch, never the source, kept for the
-- admin. A fact may be tied to a competition, a discipline and a date range: it is shown first on
-- those days (src/domain/fun-facts.ts). Facts about the game itself (points, joker) are not in this
-- bank: they are computed from the scale (decision B), see src/app/messages.fr.ts.

create table fun_facts (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(btrim(title)) between 1 and 60),
  body           text not null check (char_length(btrim(body)) between 1 and 280),
  tag            text not null check (tag in ('predictions', 'oddity', 'bar')),
  -- Where the fact was checked: shown to the admin only.
  source         text not null default '' check (char_length(source) <= 300),
  active         boolean not null default true,
  competition_id uuid references competitions(id) on delete set null,
  discipline     text references disciplines(name) on update cascade on delete set null,
  starts_on      date,
  ends_on        date,
  created_at     timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);

-- A player reads the active facts, without their source; nobody writes but the admin functions.
alter table fun_facts enable row level security;
create policy read_active on fun_facts for select to authenticated using (active);
revoke all on fun_facts from anon, authenticated;
grant select (id, title, body, tag, active, competition_id, discipline, starts_on, ends_on,
              created_at) on fun_facts to authenticated;

-- One row: the card is on or off. Read by every player, written by the admin function.
-- Every update says "where id": pg_safeupdate refuses an update without a where clause.
create table fun_fact_settings (
  id      boolean primary key default true check (id),
  enabled boolean not null default true
);
insert into fun_fact_settings default values;
alter table fun_fact_settings enable row level security;
create policy read_all on fun_fact_settings for select to authenticated using (true);
revoke all on fun_fact_settings from anon, authenticated;
grant select on fun_fact_settings to authenticated;

-- Every fact with its source, for the back-office.
create function admin_fun_facts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin reads the fact sources' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'title', f.title, 'body', f.body, 'tag', f.tag, 'source', f.source,
      'active', f.active, 'competition_slug', c.slug, 'discipline', f.discipline,
      'starts_on', f.starts_on, 'ends_on', f.ends_on) order by f.created_at, f.id)
    from fun_facts f left join competitions c on c.id = f.competition_id), '[]'::jsonb);
end $$;
revoke execute on function admin_fun_facts() from public, anon;
grant execute on function admin_fun_facts() to authenticated;

-- Adds a fact (p_id null) or edits one; returns its id. An unknown competition slug or discipline
-- is refused with 23503, as a broken foreign key.
create function admin_save_fun_fact(p_id uuid, p_fact jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_competition uuid;
  v_discipline  text := nullif(btrim(p_fact ->> 'discipline'), '');
  v_slug        text := nullif(btrim(p_fact ->> 'competition_slug'), '');
  v_id          uuid;
begin
  if not is_admin() then
    raise exception 'only an admin edits the facts' using errcode = '42501';
  end if;
  if v_slug is not null then
    select id into v_competition from competitions where slug = v_slug;
    if v_competition is null then
      raise exception 'unknown competition %', v_slug using errcode = '23503';
    end if;
  end if;
  if p_id is null then
    insert into fun_facts (title, body, tag, source, active, competition_id, discipline,
                           starts_on, ends_on)
    values (btrim(p_fact ->> 'title'), btrim(p_fact ->> 'body'), p_fact ->> 'tag',
            coalesce(btrim(p_fact ->> 'source'), ''), coalesce((p_fact ->> 'active')::boolean, true),
            v_competition, v_discipline, (p_fact ->> 'starts_on')::date,
            (p_fact ->> 'ends_on')::date)
    returning id into v_id;
  else
    update fun_facts set
      title = btrim(p_fact ->> 'title'), body = btrim(p_fact ->> 'body'), tag = p_fact ->> 'tag',
      source = coalesce(btrim(p_fact ->> 'source'), ''),
      active = coalesce((p_fact ->> 'active')::boolean, true),
      competition_id = v_competition, discipline = v_discipline,
      starts_on = (p_fact ->> 'starts_on')::date, ends_on = (p_fact ->> 'ends_on')::date
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function admin_save_fun_fact(uuid, jsonb) from public, anon;
grant execute on function admin_save_fun_fact(uuid, jsonb) to authenticated;

create function admin_delete_fun_fact(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin deletes a fact' using errcode = '42501';
  end if;
  delete from fun_facts where id = p_id;
end $$;
revoke execute on function admin_delete_fun_fact(uuid) from public, anon;
grant execute on function admin_delete_fun_fact(uuid) to authenticated;

-- Switches the card on or off; the next opening of the home follows it.
create function admin_set_fun_facts_enabled(p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin switches the facts' using errcode = '42501';
  end if;
  update fun_fact_settings set enabled = p_enabled where id;
end $$;
revoke execute on function admin_set_fun_facts_enabled(boolean) from public, anon;
grant execute on function admin_set_fun_facts_enabled(boolean) to authenticated;

-- The starting bank: 48 facts, each checked against the source next to it (the admin edits them
-- afterwards). Facts that name a discipline come first on a day with an event of it; the
-- discipline is looked up so a renamed or deleted one leaves the fact untied.
insert into fun_facts (title, body, tag, source, discipline, created_at)
select v.title, v.body, v.tag, v.source,
       (select d.name from disciplines d where d.name = v.discipline),
       now() + make_interval(secs => v.n)
from (values
  (1, 'Le 9 s 58 de Berlin',
   'Usain Bolt a couru le 100 m en 9 s 58 aux Mondiaux de Berlin, le 16 août 2009. Quatre jours plus tard, il signait 19 s 19 sur 200 m.',
   'bar', 'https://fr.wikipedia.org/wiki/Usain_Bolt', '100 m'),
  (2, 'Plus de 44 km/h',
   'Pendant son 9 s 58, Usain Bolt a dépassé les 44 km/h entre le 60e et le 80e mètre.',
   'oddity', 'https://en.wikipedia.org/wiki/Usain_Bolt', '100 m'),
  (3, 'Le faux départ ne pardonne plus',
   'Depuis 2010, un seul faux départ suffit à être disqualifié. Partir moins de 0,100 s après le coup de pistolet compte comme un faux départ.',
   'predictions', 'https://en.wikipedia.org/wiki/False_start', '100 m'),
  (4, 'Le vent compte',
   'Sur 100 m, 200 m, haies courtes, longueur et triple saut, une performance n''est pas homologuée comme record si le vent arrière dépasse 2 m/s.',
   'predictions', 'https://en.wikipedia.org/wiki/Wind_assistance', null),
  (5, 'Le torse fait foi',
   'À l''arrivée, c''est le torse qui compte : ni la tête, ni les bras, ni les pieds. La photo-finish départage les athlètes au millième de seconde.',
   'predictions', 'https://en.wikipedia.org/wiki/Photo_finish', null),
  (6, 'Le premier Français sous les 10 s',
   'Christophe Lemaitre est devenu le premier Français à courir le 100 m en moins de 10 secondes : 9 s 98 à Albi, le 9 juillet 2010.',
   'bar', 'https://fr.wikipedia.org/wiki/Christophe_Lemaitre', '100 m'),
  (7, 'Le 10 s 49 de 1988',
   'Florence Griffith-Joyner a couru le 100 m en 10 s 49 à Indianapolis en 1988, puis le 200 m en 21 s 34 aux Jeux de Séoul la même année.',
   'bar', 'https://fr.wikipedia.org/wiki/Florence_Griffith-Joyner', '200 m'),
  (8, 'Le doublé d''Atlanta',
   'Aux Jeux d''Atlanta 1996, Marie-José Pérec et Michael Johnson ont tous les deux gagné le 200 m et le 400 m.',
   'bar', 'https://fr.wikipedia.org/wiki/Marie-Jos%C3%A9_P%C3%A9rec', '400 m'),
  (9, 'Trois fois championne olympique',
   'Marie-José Pérec a gagné trois titres olympiques : le 400 m à Barcelone en 1992, puis le 200 m et le 400 m à Atlanta en 1996.',
   'bar', 'https://fr.wikipedia.org/wiki/Marie-Jos%C3%A9_P%C3%A9rec', null),
  (10, 'Le record le plus ancien',
   'Le record du monde du 800 m féminin, 1 min 53 s 28, a été établi par Jarmila Kratochvílová à Munich en 1983. Quarante ans plus tard, personne ne l''avait battu.',
   'bar', 'https://fr.wikipedia.org/wiki/Jarmila_Kratochv%C3%ADlov%C3%A1', '800 m'),
  (11, 'Le saut du siècle',
   'Aux Jeux de Mexico 1968, Bob Beamon a sauté 8,90 m en longueur : 55 cm de plus que l''ancien record du monde.',
   'bar', 'https://fr.wikipedia.org/wiki/Bob_Beamon', 'Saut en longueur'),
  (12, '23 ans plus tard',
   'Le record de Bob Beamon a tenu près de 23 ans, jusqu''aux 8,95 m de Mike Powell aux Mondiaux de Tokyo, en 1991.',
   'bar', 'https://en.wikipedia.org/wiki/Mike_Powell_(long_jumper)', 'Saut en longueur'),
  (13, 'Le saut sur le dos',
   'Dick Fosbury a gagné le saut en hauteur des Jeux de Mexico 1968 en passant la barre sur le dos. Presque tous les sauteurs l''imitent aujourd''hui.',
   'oddity', 'https://fr.wikipedia.org/wiki/Dick_Fosbury', 'Saut en hauteur'),
  (14, '2,45 m en hauteur',
   'Javier Sotomayor a franchi 2,45 m en saut en hauteur à Salamanque, en 1993 : plus que la hauteur d''une porte de garage.',
   'bar', 'https://fr.wikipedia.org/wiki/Javier_Sotomayor', 'Saut en hauteur'),
  (15, 'Trois échecs et c''est fini',
   'En hauteur comme à la perche, trois échecs de suite éliminent l''athlète, quelle que soit la barre. Il peut aussi passer une barre pour garder ses essais.',
   'predictions', 'https://en.wikipedia.org/wiki/High_jump', 'Saut en hauteur'),
  (16, 'Départager les ex aequo',
   'En hauteur et à la perche, à barre égale, l''athlète qui a fait le moins d''échecs à sa dernière barre passe devant, puis celui qui en a fait le moins en tout.',
   'predictions', 'https://en.wikipedia.org/wiki/High_jump', 'Saut à la perche'),
  (17, 'Le record chez Bubka',
   'En février 2014, Renaud Lavillenie a sauté 6,16 m à Donetsk, au meeting de Sergueï Bubka, et lui a pris son record du monde de 6,15 m datant de 1993.',
   'bar', 'https://fr.wikipedia.org/wiki/Renaud_Lavillenie', 'Saut à la perche'),
  (18, '35 records du monde',
   'Sergueï Bubka a battu 35 fois le record du monde du saut à la perche : 17 fois en plein air et 18 fois en salle.',
   'bar', 'https://fr.wikipedia.org/wiki/Sergue%C3%AF_Bubka', 'Saut à la perche'),
  (19, 'Mondo, né en Louisiane',
   'Armand Duplantis est né aux États-Unis, en Louisiane, mais saute pour la Suède, le pays de sa mère. Son premier record du monde : 6,17 m à Toruń, en 2020.',
   'bar', 'https://fr.wikipedia.org/wiki/Armand_Duplantis', 'Saut à la perche'),
  (20, '42,195 km',
   'La distance du marathon vient des Jeux de Londres 1908. Elle a été fixée officiellement à 42,195 km en 1921.',
   'bar', 'https://fr.wikipedia.org/wiki/Marathon_(sport)', null),
  (21, 'Sous les deux heures',
   'En 2019 à Vienne, Eliud Kipchoge a couru un marathon en 1 h 59 min 40 s. Avec des lièvres qui se relayaient, le temps n''a pas été homologué.',
   'oddity', 'https://en.wikipedia.org/wiki/Ineos_1:59_Challenge', null),
  (22, 'Pieds nus à Rome',
   'Abebe Bikila a gagné le marathon des Jeux de Rome 1960 pieds nus. Quatre ans plus tard à Tokyo, chaussé cette fois, il gagnait encore.',
   'oddity', 'https://fr.wikipedia.org/wiki/Abebe_Bikila', null),
  (23, 'Le triplé de la locomotive',
   'Aux Jeux d''Helsinki 1952, Emil Zátopek a gagné le 5 000 m, le 10 000 m et le marathon. C''était le premier marathon de sa vie.',
   'bar', 'https://fr.wikipedia.org/wiki/Emil_Z%C3%A1topek', '10 000 m'),
  (24, 'Neuf fois en or',
   'Le Finlandais Paavo Nurmi a gagné neuf titres olympiques en course à pied, aux Jeux de 1920, 1924 et 1928.',
   'bar', 'https://fr.wikipedia.org/wiki/Paavo_Nurmi', '5000 m'),
  (25, 'Le mile en moins de 4 minutes',
   'Le 6 mai 1954 à Oxford, Roger Bannister est devenu le premier homme à courir le mile (1 609 m) en moins de 4 minutes : 3 min 59 s 4.',
   'bar', 'https://fr.wikipedia.org/wiki/Roger_Bannister', '1500 m'),
  (26, 'Le 3 min 26 de Rome',
   'Hicham El Guerrouj a couru le 1 500 m en 3 min 26 s 00 au Golden Gala de Rome, en 1998.',
   'bar', 'https://fr.wikipedia.org/wiki/Hicham_El_Guerrouj', '1500 m'),
  (27, 'Quinze ans et plus',
   'Les records du monde du 5 000 m et du 10 000 m de Kenenisa Bekele, établis en 2004 et 2005, ont tenu jusqu''en 2020 et Joshua Cheptegei.',
   'bar', 'https://fr.wikipedia.org/wiki/Kenenisa_Bekele', '5000 m'),
  (28, '28 barrières et 7 rivières',
   'Le 3 000 m steeple compte 28 passages de barrières et 7 passages de la rivière, une fosse remplie d''eau derrière une barrière.',
   'oddity', 'https://fr.wikipedia.org/wiki/3_000_m%C3%A8tres_steeple', '3000 m steeple'),
  (29, 'Le steeple au féminin',
   'Le 3 000 m steeple féminin n''est entré au programme des Jeux olympiques qu''en 2008, à Pékin.',
   'bar', 'https://fr.wikipedia.org/wiki/3_000_m%C3%A8tres_steeple', '3000 m steeple'),
  (30, 'Sous les 46 secondes',
   'Aux Jeux de Tokyo 2021, Karsten Warholm a couru le 400 m haies en 45 s 94 : le premier sous les 46 secondes.',
   'bar', 'https://fr.wikipedia.org/wiki/Karsten_Warholm', '400 m haies'),
  (31, 'Dix haies, pas plus',
   'Le 110 m haies, le 100 m haies et le 400 m haies comptent tous dix haies. Au 110 m, elles mesurent 1,067 m de haut ; au 100 m, 0,838 m.',
   'oddity', 'https://fr.wikipedia.org/wiki/110_m%C3%A8tres_haies', '110 m haies'),
  (32, 'Faire tomber une haie',
   'Renverser une haie n''est pas une faute : l''athlète n''est disqualifié que s''il la fait tomber exprès, avec la main, ou s''il passe à côté.',
   'predictions', 'https://en.wikipedia.org/wiki/Hurdling', '100 m haies'),
  (33, '7,26 kg',
   'Le poids des hommes pèse 7,26 kg, soit 16 livres ; celui des femmes, 4 kg. Le marteau masculin pèse aussi 7,26 kg.',
   'oddity', 'https://fr.wikipedia.org/wiki/Lancer_du_poids', 'Lancer du poids'),
  (34, 'Le javelot trop loin',
   'En 1984, Uwe Hohn a lancé le javelot à 104,80 m. Pour éviter les lancers hors du stade, le javelot masculin a été redessiné en 1986.',
   'oddity', 'https://fr.wikipedia.org/wiki/Uwe_Hohn', 'Javelot'),
  (35, 'Le marteau des femmes',
   'Le lancer du marteau féminin n''est entré aux Jeux olympiques qu''en 2000, à Sydney.',
   'bar', 'https://fr.wikipedia.org/wiki/Lancer_du_marteau', 'Lancer du marteau'),
  (36, 'Trois essais, puis trois de plus',
   'Aux grands championnats, en finale de lancer, de longueur ou de triple saut, chacun a trois essais ; les huit meilleurs en reçoivent trois de plus. Le meilleur essai compte.',
   'predictions', 'https://en.wikipedia.org/wiki/Long_jump', 'Lancer du disque'),
  (37, '9 126 points',
   'Kevin Mayer a battu le record du monde du décathlon avec 9 126 points, au Décastar de Talence, en septembre 2018.',
   'bar', 'https://fr.wikipedia.org/wiki/Kevin_Mayer', 'Décathlon'),
  (38, 'Dix épreuves en deux jours',
   'Le décathlon enchaîne dix épreuves en deux jours, du 100 m au 1 500 m. L''heptathlon en compte sept, aussi sur deux jours.',
   'oddity', 'https://fr.wikipedia.org/wiki/D%C3%A9cathlon', 'Décathlon'),
  (39, '7 291 points',
   'Aux Jeux de Séoul 1988, Jackie Joyner-Kersee a gagné l''heptathlon avec 7 291 points.',
   'bar', 'https://fr.wikipedia.org/wiki/Jackie_Joyner-Kersee', 'Heptathlon'),
  (40, 'Le témoin dans la zone',
   'Au relais, le témoin doit passer de main en main dans une zone de transmission. Hors de la zone, l''équipe est disqualifiée.',
   'predictions', 'https://fr.wikipedia.org/wiki/Relais_4_%C3%97_100_m%C3%A8tres', 'Relais 4x100 m'),
  (41, '36 s 84',
   'Aux Jeux de Londres 2012, la Jamaïque a couru le relais 4 × 100 m en 36 s 84, avec Usain Bolt en dernier relayeur.',
   'bar', 'https://fr.wikipedia.org/wiki/Relais_4_%C3%97_100_m%C3%A8tres', 'Relais 4x100 m'),
  (42, 'Quatre fois en or',
   'Jesse Owens a gagné quatre titres aux Jeux de Berlin 1936 : 100 m, 200 m, longueur et relais 4 × 100 m. Carl Lewis a fait pareil à Los Angeles en 1984.',
   'bar', 'https://fr.wikipedia.org/wiki/Jesse_Owens', null),
  (43, 'Quatre Jeux, quatre titres',
   'Carl Lewis a gagné le saut en longueur à quatre Jeux olympiques de suite, de 1984 à 1996.',
   'bar', 'https://fr.wikipedia.org/wiki/Carl_Lewis', 'Saut en longueur'),
  (44, 'La première course',
   'La première épreuve olympique connue est le stadion, une course d''environ 190 m, à Olympie en 776 av. J.-C. Le mot « stade » vient de là.',
   'oddity', 'https://en.wikipedia.org/wiki/Stadion_(running_race)', null),
  (45, 'Une piste violette',
   'Aux Jeux de Paris 2024, la piste du Stade de France était violette.',
   'oddity', 'https://fr.wikipedia.org/wiki/Athl%C3%A9tisme_aux_Jeux_olympiques_d%27%C3%A9t%C3%A9_de_2024', null),
  (46, 'La Ligue de diamant',
   'La Ligue de diamant a remplacé la Golden League en 2010. Le vainqueur de chaque finale reçoit le Diamond Trophy.',
   'bar', 'https://fr.wikipedia.org/wiki/Ligue_de_diamant', null),
  (47, 'Les couloirs du milieu',
   'En finale de sprint, les quatre meilleurs des demi-finales tirent au sort les couloirs 3 à 6. Le couloir dit souvent qui est attendu devant.',
   'predictions', 'https://en.wikipedia.org/wiki/Lane_(athletics)', '200 m'),
  (48, 'La perche au féminin',
   'Le saut à la perche féminin est entré aux Jeux olympiques en 2000, à Sydney ; l''Américaine Stacy Dragila a été la première championne.',
   'bar', 'https://fr.wikipedia.org/wiki/Stacy_Dragila', 'Saut à la perche')
) as v(n, title, body, tag, source, discipline);
