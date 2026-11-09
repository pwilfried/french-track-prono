# Sentry : être prévenu d'une erreur en prod (#195)

Sentry reçoit les erreurs du site (serveur et navigateur) et les pannes de service
(`…_UNAVAILABLE` : base ou service qui ne répond pas, que le joueur ne voit que comme un message,
groupées par code grâce à l'étiquette `code`). Pas de suivi des performances, pas de replay.

Sans DSN, rien n'est envoyé ; en local et en mode fake (`FTP_FAKE_DB=1`) non plus.

## Données personnelles

- Région UE (`de.sentry.io`), cohérent avec le RGPD.
- Un événement ne contient jamais l'e-mail ni le pseudo : seulement l'identifiant Supabase du
  joueur (uuid). Le corps des requêtes et les cookies sont retirés (`scrub`, `src/infra/sentry.ts`).
- Les envois passent par `/monitoring` sur notre propre domaine : pas de changement de la CSP,
  et les bloqueurs de publicité ne les coupent pas.

## Mise en route (propriétaire, une fois)

1. Créer un compte Sentry en choisissant la région **EU**, puis un projet « Next.js ».
2. Copier le **DSN** du projet (Settings → Client Keys), de la forme
   `https://…@o….ingest.de.sentry.io/…`.
3. Vercel, variables de production : `NEXT_PUBLIC_SENTRY_DSN` = le DSN.
4. Sentry → Settings → Auth Tokens : un jeton d'organisation (portée « project:releases »).
5. GitHub, environnement « production » : secrets `SENTRY_AUTH_TOKEN` (le jeton), `SENTRY_ORG` et
   `SENTRY_PROJECT` (les identifiants courts de l'organisation et du projet).
6. Poser un tag : le déploiement envoie les source maps (piles d'appels lisibles), jamais depuis
   un poste local.

Le DSN n'est pas un secret (il finit dans le navigateur) ; le jeton, si.

## Vérifier

Après le déploiement, une erreur volontaire (par exemple dans la console du navigateur sur le
site : `setTimeout(() => { throw new Error("test sentry") })`) doit apparaître dans Sentry en moins
d'une minute.
