# Import des résultats par lien World Athletics et mise à jour nocturne des fiches athlètes

Étude (spike) #670, 13 novembre 2026. Aucune ligne de code de production ; les essais ont été
faits depuis un runner GitHub Actions, avec `curl` et un script Python jetable non commité.

## Décision en une phrase

**Techniquement faisable et simple, mais interdit par les conditions d'utilisation de World
Athletics sans autorisation écrite.** On ne construit ni l'import par lien ni la tâche
nocturne tant que cette autorisation n'existe pas ; le collage du tableau (#666) reste la voie
de saisie, et le non-objectif 3 reste en l'état.

## 1. Où sont les données ?

Les pages de World Athletics sont rendues par le serveur (Next.js). **Le tableau complet est
dans le HTML renvoyé**, dans le bloc `<script id="__NEXT_DATA__" type="application/json">`. Pas
besoin d'exécuter du JavaScript ni d'appeler un service interne.

Pages essayées (toutes en HTTP 200) :

| Page | Forme des données | Ce qu'on y trouve |
|---|---|---|
| Mondiaux Tokyo 2025, 100 m hommes, finale | `props.pageProps.eventPhasesByDiscipline.units[0].results[]` (type `eventPhaseResult`) | 8 lignes : `resultRank`, `competitorName`, `competitorCountryCode`, `resultMark`, `resultWind`, `record` (`"PB"`), `competitorId_WA` |
| Mondiaux Tokyo 2025, hauteur femmes, finale | idem, plus `series` (les essais) | 16 lignes ; **ex æquo** : rangs `1, 2, 3, 3, 5, 5…` ; `NM` sans rang |
| Mondiaux Tokyo 2025, marathon hommes | idem | 90 lignes, dont 22 `DNF` et 2 `DNS`, `resultRank` à `null` |
| Meeting de Doha 2026 (Diamond League), page du meeting | `props.pageProps.calendarEventsResults.eventTitles[].events[].races[].results[]` (type `CalendarResultsRaceResult`) | les 16 épreuves du meeting sur une seule page : `place` (`"1."`, ou vide), `mark`, `nationality`, `records`, `competitor.iaafId`, `competitor.urlSlug` ; `DNF` et `DQ` au 3 000 m steeple |

Extrait (100 m, Tokyo 2025, une ligne, champs utiles seulement) :

```json
{ "competitorName": "Oblique SEVILLE", "competitorId_WA": 14737998,
  "competitorCountryCode": "JAM", "resultMark": "9.77", "resultWind": "+0.3",
  "resultRank": 1, "record": "PB" }
```

Constats utiles pour #666 aussi :

- **Deux formes différentes** : grands championnats (une page par épreuve et par tour) et
  meetings du calendrier, dont la Diamond League (une page pour tout le meeting, épreuves à
  retrouver par leur nom, p. ex. `"Men's 200 Metres"`).
- Les **ex æquo** existent (deux médailles de bronze à la hauteur) : la feuille de résultats doit
  les accepter.
- `DNF`, `DNS`, `DQ`, `NM` sont dans le champ de la marque, sans rang. Une ligne peut aussi
  avoir une marque et une place vide (triple saut de Doha) : à traiter comme « non classé ».
- Le site a bien un service interne (GraphQL) derrière le calendrier et la recherche, appelé
  depuis le navigateur. Il n'a pas été exploré : il faudrait réutiliser une clé intégrée au
  site, ce qui n'est ni stable ni acceptable.

## 2. Autorisation

**`robots.txt`** (lu le 13 nov. 2026) autorise tout :

```
User-agent: *
Allow: /sitemap
sitemap: https://worldathletics.org/sitemap/sitemapindex.xml
Allow: /
```

**Conditions d'utilisation** (`https://worldathletics.org/terms-and-conditions`, lues le
13 nov. 2026) : elles l'interdisent explicitement.

> 4.1. Unless expressly authorised in writing by World Athletics, you must not use any robot,
> spider, crawler, scraper, artificial intelligence system, machine learning model, large
> language model, automated agent, data mining tool, harvesting tool or other automated means to
> access, collect, copy, monitor, extract, reproduce, analyse, index, store, republish or
> otherwise use any content, data, materials, trademarks, databases […] available on or through
> the Platform.

> 2.2. You may download a single copy of the material on the Platform on a single computer for
> your own private viewing/listening purposes only.

> 2.4. No copying or distribution of material on the Platform for any commercial or promotional
> purposes […] is permitted without our prior written consent.

Lecture : `robots.txt` dit seulement aux robots d'indexation où passer ; les conditions
d'utilisation, elles, interdisent toute lecture automatique (« access, collect, extract,
store ») sans accord écrit. Un serveur qui va chercher la page à partir d'un lien collé par
l'admin est un « automated means to access […] extract », même s'il ne fait qu'une requête par
épreuve. Une tâche nocturne l'est encore plus clairement. Le jeu est gratuit, mais la clause 4.1
ne fait pas de différence entre usage commercial et non commercial.

C'est la même situation que la base des clubs de la FFA (`docs/decisions/profils.md`) : on ne
l'utilise pas.

## 3. Depuis l'hébergement

- **Runner GitHub Actions** : toutes les pages répondent `200`, sans captcha, en moins d'une
  seconde (fiche athlète : 180 Ko, 0,8 s). Le site est servi par CloudFront (`X-Cache: Hit from
  cloudfront`).
- Une requête **sans `User-Agent`** reçoit `403` ; avec n'importe quel `User-Agent`, même un nom
  de robot explicite (`french-track-prono-spike/0.1`), `200`. Pas de protection anti-robot visible
  aujourd'hui, mais rien n'empêche World Athletics d'en ajouter une.
- **Fonction Vercel** : non vérifié (le runner n'a pas accès à un déploiement). Les IP de Vercel
  (AWS) ne sont pas plus suspectes que celles des runners GitHub (Azure) ; à vérifier seulement si
  le projet obtient l'autorisation.

## 4. Robustesse (si c'était autorisé)

L'import dépendrait de choses que World Athletics ne garantit pas :

- le nom et le chemin du bloc `__NEXT_DATA__` (`props.pageProps…`), qui change à chaque refonte du
  site, et les noms de champs (`resultMark`, `resultRank`…) ;
- deux formats de page déjà différents aujourd'hui (championnat / meeting) ;
- la forme des URL (l'ancienne `…/tokyo25/…` redirige vers `…/world-athletics-championships-tokyo-2025-7190593/…`) ;
- une protection anti-robot ajoutée plus tard (403, captcha).

Détection et repli : valider le JSON contre un schéma strict (champs requis, au moins 3 lignes,
rangs cohérents, pays sur 3 lettres) ; toute erreur donne un code énuméré (`source_unreachable`,
`source_format_changed`, `event_not_found`) et ouvre le collage de texte (#666) avec le message
« Collez le tableau ». Rien n'est enregistré sans relecture de l'admin. Un test de contrat
hebdomadaire sur une page connue préviendrait d'une casse avant le jour d'une compétition.

## 5. Fiches athlètes

`/athletes/<pays>/<nom>-<id>` : tout est aussi dans `__NEXT_DATA__`, sous
`props.pageProps.competitor` :

- `personalBests.results[]` : épreuve, marque, vent, date, lieu, `records` (`["=NR"]`) ;
- `seasonsBests.results[]` : meilleure marque de la saison, avec la compétition ;
- `resultsByYear.resultsByEvent[].results[]` : tous les résultats de l'année (date, compétition,
  `place`, marque) : de quoi tirer « dernière course » et « dernières victoires » ;
- `honours[]` : médailles et titres ;
- `basicData` : nom, pays, date de naissance, identifiant (`iaafId`).

Mêmes conditions d'utilisation (clause 4.1), même accès depuis le runner (200).

## 6. Tâche planifiée sans IA (si c'était autorisé)

- **Où** : GitHub Actions (comme l'import des clubs), pas un cron Vercel : pas de limite de durée
  de fonction, journaux lisibles, et la clé `service_role` reste dans les secrets du dépôt.
- **Qui** : chaque nuit, les athlètes des listes de départ des compétitions à venir et ceux
  alignés en Manager (quelques dizaines) ; les autres une fois par semaine.
- **Rythme** : une requête toutes les 5 s, en série, avec un `User-Agent` qui nomme le projet.
  50 athlètes ≈ 4 min ; 500 athlètes (hebdomadaire) ≈ 45 min.
- **Échec** : on garde la dernière valeur, on note `last_checked_at` et un état « à vérifier »
  sur la fiche ; trois échecs de suite ou un format inconnu ouvrent une issue.

## 7. Rapprochement athlète ↔ World Athletics

La table `athletes` n'a pas d'identifiant externe. Il faudrait une colonne `wa_id` (entier,
unique, facultative), remplie une fois :

- au moment de l'import d'un résultat : chaque ligne porte déjà l'identifiant
  (`competitorId_WA` / `competitor.iaafId`) et le chemin de la fiche (`competitor.urlSlug`) ;
- ou à la main par l'admin, en collant le lien de la fiche (l'identifiant est la fin de l'URL :
  `…/oblique-seville-14737998`).

La recherche d'athlètes du site passe par le service interne : pas de recherche automatique.

## 8. Règle du projet

Le non-objectif 3 (« Pas d'import automatique des listes de départ ni des résultats : l'admin les
saisit ») interdit déjà l'import par lien et la tâche nocturne. L'étude ne recommande **pas** de
le changer aujourd'hui : la règle du projet et les conditions de World Athletics disent la même
chose. Elle ne serait à revoir qu'avec une autorisation écrite de World Athletics (ou une source
sous licence).

## Ce qu'on fait

1. **Garder le collage** du tableau (#666) : c'est l'admin qui copie, à la main, ce qu'il lit à
   l'écran. Le parseur doit accepter les ex æquo, `DNF`/`DNS`/`DQ`/`NM` et les lignes sans place.
2. **Fiche athlète** (#679) : saisie par l'admin, comme aujourd'hui.
3. **Optionnel, coût nul** : stocker le lien de la fiche World Athletics d'un athlète (saisi par
   l'admin) pour l'afficher comme lien sortant. Un lien n'est pas une copie ; la clause 7 des
   conditions encadre seulement la façon de lier (pas d'association ni de logo).
4. Si le propriétaire veut aller plus loin : écrire à World Athletics pour demander une
   autorisation écrite (projet gratuit, sans publicité, quelques dizaines de requêtes par nuit).

## Estimation, si l'autorisation est obtenue

- Import par lien (adaptateur `infra` + port avec fake, schéma de validation, repli sur #666,
  test de contrat) : **une issue moyenne, 1 à 2 jours d'agent**.
- Colonne `wa_id` + rapprochement à l'import : **une petite issue**.
- Tâche nocturne des fiches (workflow GitHub, état « à vérifier », issue automatique en cas de
  casse) : **une issue moyenne, 1 à 2 jours d'agent**.
- Plus une modification du non-objectif 3 dans `docs/architecture.md`.

NEEDS-ANSWER: Les conditions d'utilisation de World Athletics (clause 4.1) interdisent toute lecture automatique sans accord écrit ; veux-tu qu'on en reste au collage du tableau (#666) et à la saisie manuelle des fiches, ou préfères-tu écrire à World Athletics pour demander une autorisation avant d'aller plus loin ?
