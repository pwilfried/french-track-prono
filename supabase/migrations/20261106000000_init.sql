-- =====================================================================
-- French Track Prono — schéma V1 (PostgreSQL / Supabase)
-- Un "Mon Petit Prono" pour l'athlétisme : on pronostique des podiums.
--
-- Principes de conception
--  * Barème modifiable en base (table scoring_rules), pas codé en dur.
--  * Le calcul des points est fait par le domaine TypeScript, écrit via service_role.
--  * Verrouillage automatique au départ de l'épreuve (trigger).
--  * Les pronos des autres ne sont visibles qu'APRES le verrouillage
--    (pas de copiage, et ça fait monter le suspense).
--  * Chaque point gagné est tracé dans score_events : on peut afficher
--    "+9 pts, tu as trouvé le vainqueur" et recalculer sans erreur.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
create type event_status as enum ('upcoming', 'live', 'finished');
create type athlete_kind as enum ('athlete', 'team');   -- 'team' = relais
create type league_role  as enum ('owner', 'member');

-- ---------------------------------------------------------------------
-- Utilisateurs et ligues
-- (profiles.id = auth.users.id sous Supabase)
-- ---------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  pseudo       text not null unique check (char_length(pseudo) between 2 and 24),
  avatar_emoji text not null default '🏃',
  created_at   timestamptz not null default now()
);

create table leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 40),
  emoji       text not null default '🏆',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  owner_id    uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table league_members (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      league_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index on league_members (user_id);

-- ---------------------------------------------------------------------
-- Compétitions, épreuves, athlètes
-- ---------------------------------------------------------------------
create table competitions (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  city         text,
  country_code char(3),
  starts_on    date not null,
  ends_on      date not null,
  level        text,                       -- diamond-league, championnat, jo...
  status       event_status not null default 'upcoming',
  check (ends_on >= starts_on)
);

create table league_competitions (
  league_id      uuid not null references leagues(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  primary key (league_id, competition_id)
);

create table athletes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  country_code char(3) not null,
  gender       char(1) not null check (gender in ('F', 'M', 'X')),
  kind         athlete_kind not null default 'athlete',
  photo_url    text
);
create index on athletes (country_code);

create table events (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  slug           text not null,
  discipline     text not null,            -- "100 m", "Saut à la perche"...
  gender         char(1) not null check (gender in ('F', 'M', 'X')),
  round          text not null default 'final',
  starts_at      timestamptz not null,
  lock_at        timestamptz not null,     -- fin des pronos
  is_featured    boolean not null default false,   -- "épreuve phare"
  status         event_status not null default 'upcoming',
  unique (competition_id, slug),
  check (lock_at <= starts_at)
);
create index on events (competition_id, starts_at);

-- Liste de départ : qui court quoi
create table entries (
  event_id    uuid not null references events(id) on delete cascade,
  athlete_id  uuid not null references athletes(id) on delete cascade,
  season_best text,
  primary key (event_id, athlete_id)
);

-- Résultats officiels (rang 1, 2, 3... ; les ex æquo partagent le même rang)
create table results (
  event_id   uuid not null,
  athlete_id uuid not null,
  rank       int  not null check (rank >= 1),
  mark       text,                         -- temps ou marque, en texte
  primary key (event_id, athlete_id),
  foreign key (event_id, athlete_id) references entries(event_id, athlete_id) on delete cascade
);
create index on results (event_id, rank);

-- ---------------------------------------------------------------------
-- Pronostics
-- ---------------------------------------------------------------------
create table predictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  event_id       uuid not null references events(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade, -- rempli par trigger
  p1             uuid not null,
  p2             uuid not null,
  p3             uuid not null,
  use_joker      boolean not null default false,
  points_awarded int,                      -- null tant que non calculé
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, event_id),
  check (p1 <> p2 and p1 <> p3 and p2 <> p3),
  -- on ne peut pronostiquer que des athlètes réellement engagés
  foreign key (event_id, p1) references entries(event_id, athlete_id),
  foreign key (event_id, p2) references entries(event_id, athlete_id),
  foreign key (event_id, p3) references entries(event_id, athlete_id)
);
create index on predictions (event_id);
-- Un seul joker par joueur et par compétition
create unique index one_joker_per_competition
  on predictions (user_id, competition_id) where use_joker;

-- Questions bonus (record battu ? nombre de médailles ?)
create table bonus_questions (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  label          text not null,
  answer_type    text not null check (answer_type in ('yes_no', 'number', 'athlete')),
  points         int  not null default 2 check (points between 1 and 10),
  lock_at        timestamptz not null,
  correct_answer text
);

create table bonus_answers (
  question_id    uuid not null references bonus_questions(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  answer         text not null,
  points_awarded int,
  primary key (question_id, user_id)
);

-- ---------------------------------------------------------------------
-- Barème (modifiable sans toucher au code)
-- ---------------------------------------------------------------------
create table scoring_rules (
  key         text primary key,
  value       numeric not null,
  description text not null
);

insert into scoring_rules (key, value, description) values
  ('exact_slot',        3,    'Bon athlète à la bonne place (par place)'),
  ('wrong_place',       1,    'Athlète sur le podium mais à la mauvaise place'),
  ('perfect_podium',    3,    'Bonus podium parfait dans l''ordre'),
  ('flair_bonus',       2,    'Coup de flair : vainqueur trouvé alors que peu de joueurs l''avaient choisi'),
  ('flair_threshold',   0.15, 'Part maximale de joueurs ayant choisi ce vainqueur pour le coup de flair'),
  ('flair_min_players', 10,   'Nombre minimum de pronos sur l''épreuve pour activer le coup de flair'),
  ('joker_multiplier',  2,    'Multiplicateur du joker (une épreuve par compétition)');

-- ---------------------------------------------------------------------
-- Points et badges
-- ---------------------------------------------------------------------
create table score_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  competition_id    uuid not null references competitions(id) on delete cascade,
  event_id          uuid references events(id) on delete cascade,
  bonus_question_id uuid references bonus_questions(id) on delete cascade,
  source            text not null check (source in ('prediction', 'bonus', 'streak', 'manual')),
  points            int  not null,
  reason            text not null,         -- "Vainqueur du 100 m trouvé"
  detail            jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
create unique index one_score_per_prediction
  on score_events (user_id, event_id) where source = 'prediction';
create index on score_events (competition_id, user_id);

create table badges (
  code        text primary key,
  label       text not null,
  description text not null,
  emoji       text not null
);

create table user_badges (
  user_id    uuid not null references profiles(id) on delete cascade,
  badge_code text not null references badges(code),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

insert into badges (code, label, description, emoji) values
  ('nostradamus',    'Nostradamus',         'Un podium parfait dans l''ordre',                     '🔮'),
  ('outsider-hunter','Chasseur d''outsiders','Un coup de flair réussi',                             '🎯'),
  ('flamme',         'Série en feu',        '3 épreuves de suite avec des points',                  '🔥'),
  ('fan-des-bleus',  'Fan des Bleus',       'Un athlète français dans ton prono, 5 fois',           '🇫🇷');

-- ---------------------------------------------------------------------
-- Verrouillage des pronos au départ de l'épreuve
-- ---------------------------------------------------------------------
create or replace function enforce_prediction_lock() returns trigger
language plpgsql as $$
declare
  v_lock timestamptz;
  v_comp uuid;
begin
  select lock_at, competition_id into v_lock, v_comp from events where id = new.event_id;
  if now() >= v_lock then
    raise exception 'Pronostic verrouillé : l''épreuve a commencé' using errcode = 'P0001';
  end if;
  new.competition_id := v_comp;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_prediction_lock
  before insert or update of p1, p2, p3, use_joker on predictions
  for each row execute function enforce_prediction_lock();

-- Le calcul des points n'est PAS en SQL : il vit dans src/domain/scoring.ts.
-- Les lignes de score_events sont écrites côté serveur (service_role) uniquement.

-- ---------------------------------------------------------------------
-- Classements
-- Départage : points, puis podiums parfaits, puis vainqueurs trouvés
-- ---------------------------------------------------------------------
create or replace view leaderboard_competition as
select s.competition_id,
       s.user_id,
       p.pseudo,
       p.avatar_emoji,
       sum(s.points)::int                                             as total_points,
       count(*) filter (where (s.detail->>'perfect')::boolean)        as perfect_podiums,
       count(*) filter (where (s.detail->>'winner_found')::boolean)   as winners_found,
       rank() over (
         partition by s.competition_id
         order by sum(s.points) desc,
                  count(*) filter (where (s.detail->>'perfect')::boolean) desc,
                  count(*) filter (where (s.detail->>'winner_found')::boolean) desc
       ) as rank
from score_events s
join profiles p on p.id = s.user_id
group by s.competition_id, s.user_id, p.pseudo, p.avatar_emoji;

create or replace view leaderboard_league as
select lm.league_id,
       lb.competition_id,
       lb.user_id,
       lb.pseudo,
       lb.avatar_emoji,
       lb.total_points,
       lb.perfect_podiums,
       lb.winners_found,
       rank() over (
         partition by lm.league_id, lb.competition_id
         order by lb.total_points desc, lb.perfect_podiums desc, lb.winners_found desc
       ) as rank
from league_members lm
join league_competitions lc on lc.league_id = lm.league_id
join leaderboard_competition lb
  on lb.user_id = lm.user_id and lb.competition_id = lc.competition_id;

-- ---------------------------------------------------------------------
-- Rejoindre une ligue avec un code d'invitation
-- ---------------------------------------------------------------------
create or replace function join_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  select id into v_league from leagues where invite_code = upper(trim(p_code));
  if v_league is null then
    raise exception 'Code d''invitation inconnu';
  end if;
  insert into league_members (league_id, user_id) values (v_league, auth.uid())
  on conflict do nothing;
  return v_league;
end $$;

-- ---------------------------------------------------------------------
-- Sécurité (Row Level Security — Supabase)
-- Les écritures sur les données de référence (compétitions, épreuves,
-- résultats...) passent par le back-office avec la clé "service role".
-- ---------------------------------------------------------------------
create or replace function is_league_member(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from league_members where league_id = p_league and user_id = auth.uid());
$$;

alter table profiles           enable row level security;
alter table leagues            enable row level security;
alter table league_members     enable row level security;
alter table league_competitions enable row level security;
alter table competitions       enable row level security;
alter table athletes           enable row level security;
alter table events             enable row level security;
alter table entries            enable row level security;
alter table results            enable row level security;
alter table predictions        enable row level security;
alter table bonus_questions    enable row level security;
alter table bonus_answers      enable row level security;
alter table scoring_rules      enable row level security;
alter table score_events       enable row level security;
alter table badges             enable row level security;
alter table user_badges        enable row level security;

-- Données publiques (lecture seule pour les joueurs connectés)
create policy read_all on competitions    for select to authenticated using (true);
create policy read_all on athletes        for select to authenticated using (true);
create policy read_all on events          for select to authenticated using (true);
create policy read_all on entries         for select to authenticated using (true);
create policy read_all on results         for select to authenticated using (true);
create policy read_all on bonus_questions for select to authenticated using (true);
create policy read_all on scoring_rules   for select to authenticated using (true);
create policy read_all on score_events    for select to authenticated using (true);
create policy read_all on badges          for select to authenticated using (true);
create policy read_all on user_badges     for select to authenticated using (true);
create policy read_all on profiles        for select to authenticated using (true);

-- Profil : chacun gère le sien
create policy own_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy own_update on profiles for update to authenticated using (id = auth.uid());

-- Ligues : visibles par leurs membres ; créées par leur propriétaire
create policy members_read on leagues        for select to authenticated
  using (owner_id = auth.uid() or is_league_member(id));
create policy owner_insert on leagues        for insert to authenticated with check (owner_id = auth.uid());
create policy owner_update on leagues        for update to authenticated using (owner_id = auth.uid());
create policy members_read on league_members for select to authenticated using (is_league_member(league_id));
create policy members_read on league_competitions for select to authenticated using (is_league_member(league_id));
create policy owner_write  on league_competitions for all to authenticated
  using (exists (select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid()));
create policy leave_league on league_members for delete to authenticated using (user_id = auth.uid());

-- Pronostics : les miens tout le temps, ceux des autres une fois l'épreuve verrouillée
create policy read_own_or_locked on predictions for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from events e where e.id = event_id and e.lock_at <= now()));
create policy write_own on predictions for insert to authenticated with check (user_id = auth.uid());
create policy update_own on predictions for update to authenticated using (user_id = auth.uid());
create policy delete_own on predictions for delete to authenticated using (user_id = auth.uid());

-- Réponses bonus : les miennes seulement
create policy own_answers on bonus_answers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
