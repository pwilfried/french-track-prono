# Performance des pages (spike #966)

État : **brouillon** (16 nov. 2026). L'analyse du code est faite ; les temps mesurés en prod
(Sentry, traces à 0,2 depuis la v0.20.2) restent à reporter dans le tableau « Mesures ».

## Constats déjà établis

- Fonctions Vercel (`lhr1`) et base de prod à Londres : la distance n'explique pas la lenteur.
  La préprod (base à Francfort) paie environ 15 ms par requête ; sans effet sur la prod.
- Lectures en « fetch failed » vers `/rest/v1/…` en prod (15 nov.), jamais retentées : le bloc
  concerné disparaît ou la page affiche une erreur.

## Ce que le code montre (lecture du 16 nov.)

Le temps d'une page suit surtout le nombre d'allers-retours **enchaînés** vers Supabase, pas le
nombre total de requêtes. Chaque page connectée commence par quatre allers-retours en série :

1. `src/proxy.ts` : `auth.getUser()` (serveur d'auth) ;
2. `src/proxy.ts` : lecture du profil (page qui exige un profil) ;
3. la page : `getCurrentUser()` refait `auth.getUser()` (le `cache` de React ne traverse pas le
   proxy) ;
4. la page : relit le profil (en-tête, accueil, profil).

Ensuite, par page (allers-retours en série après ces quatre ; « ~ » = estimation) :

| Page | Série dans la page | Enchaînements évitables |
| --- | --- | --- |
| Accueil (joueur) | ~4 : compétitions + ligues → ~10 lectures en parallèle → faits du jour | 2e vague de ~10 lectures + un classement par ligue, alors que `limitedFetch` n'en laisse passer que 8 à la fois : une vague de plus |
| Épreuve | ~5 : épreuve → cotes / utilisateur → ligues → mon prono → barème / joker | `getCurrentUser` attend l'épreuve ; ligues, mon prono et joker peuvent partir ensemble : 5 → 3 |
| Classement | ~4 : utilisateur → ligues → classements de ligue → classement général | utilisateur et compétitions en parallèle ; classement général en même temps que ceux des ligues : 4 → 2 |
| Ligue | ~3 : ligue → classement de la ligue → épreuves de la ligue | classement et épreuves dépendent de la ligue : regrouper dans une fonction SQL si les traces le montrent lent |
| Manager | ~2 : ligue / saison / fil en parallèle → compétitions disponibles (créateur) | rien d'évident |
| Profil | ~3, mais des dizaines de lectures (une par compétition et par bloc) derrière 8 places : plusieurs vagues | page probablement la plus lente ; **pas de `loading.tsx`** : écran figé pendant le chargement |

## Mesures (à compléter depuis Sentry)

Sentry → Explore → Traces, environnement production, 7 derniers jours. Pour chaque page :
médiane et p95 de la transaction, nombre de spans `http.client` vers `supabase.co`, part de
`/auth/v1/user`.

| Page | Médiane | p95 | Requêtes Supabase | Dont auth |
| --- | --- | --- | --- | --- |
| `GET /` | | | | |
| `GET /competitions/[slug]` | | | | |
| `GET /epreuves/[slug]` | | | | |
| `GET /classement` | | | | |
| `GET /ligues/[id]` | | | | |
| `GET /manager/[id]` | | | | |
| `GET /profil` | | | | |

À lire aussi : Supabase → Query Performance (requêtes les plus lentes, pour la piste 5).

## Décision proposée (ordre et gain attendu)

1. **Une nouvelle tentative sur « fetch failed »** dans `limitedFetch`, pour les lectures
   seulement (GET/HEAD), après une courte pause. Gain : les blocs vides et les pages d'erreur
   passagères. Coût : petit, testable sans réseau.
2. **Ne vérifier l'utilisateur qu'une fois par visite** : le proxy transmet l'utilisateur vérifié
   à la page (en-tête de requête interne) au lieu que la page rappelle le serveur d'auth ; ou
   `auth.getClaims()` (vérification locale du jeton) si le projet Supabase a des clés de
   signature asymétriques (Supabase → Settings → JWT Keys, à vérifier). Gain attendu : un
   aller-retour vers l'auth par page connectée (souvent le plus lent de la série).
3. **Paralléliser les écrans Épreuve et Classement** (tableau ci-dessus). Gain : 2 allers-retours
   par page.
4. **Squelette sur `/profil`** (`loading.tsx`) et, si les traces le confirment, une lecture de
   saison regroupée (fonction SQL) au lieu d'une requête par compétition.
5. Index sur les requêtes que Query Performance désigne ; fonctions SQL pour Ligue ou Accueil
   seulement si les mesures les montrent lentes.

Les points 1 à 4 tiennent dans une v0.20.3 (trois ou quatre issues). Le rendu en deux temps
(piste 3 de l'issue) attend les mesures : il ne vaut que si une partie publique arrive nettement
avant la partie personnelle.
