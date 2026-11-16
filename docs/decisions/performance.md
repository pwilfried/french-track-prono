# Performance des pages (spike #966)

Décision du 16 nov. 2026, prise sur la lecture du code : la prod n'a pas encore de joueurs, et
les traces Sentry (échantillon 0,2) n'y seraient pas assez nombreuses pour mesurer. Le
propriétaire joue en préprod ; c'est là qu'il trouve l'app lente. Les gains se vérifient à
l'usage en préprod, avant / après, et dans Sentry quand la prod aura du trafic.

## Constats

- **Préprod : fonctions à Londres, base à Francfort.** `vercel.json` fixe `lhr1` pour les deux
  environnements ; le déploiement de préprod du 16 nov. tourne bien en `lhr1`. Chaque requête
  vers la base fait l'aller-retour Londres–Francfort (environ 15 ms), et une page en enchaîne
  plusieurs. La prod (fonctions et base à Londres) n'a pas cet écart.
- **Lectures en « fetch failed »** vers `/rest/v1/…` en prod (15 nov.), jamais retentées : le bloc
  concerné disparaît ou la page affiche une erreur.
- **Peu de trafic = fonctions souvent froides** : un démarrage à froid s'ajoute à beaucoup de
  visites ; aucune correction ci-dessous ne le supprime, mais chaque aller-retour évité compte
  aussi à froid.

## Ce que le code montre

Le temps d'une page suit surtout le nombre d'allers-retours **enchaînés** vers Supabase, pas le
nombre total de requêtes. Chaque page connectée commence par quatre allers-retours en série :

1. `src/proxy.ts` : `auth.getUser()` (serveur d'auth) ;
2. `src/proxy.ts` : lecture du profil (page qui exige un profil) ;
3. la page : `getCurrentUser()` refait `auth.getUser()` (le `cache` de React ne traverse pas le
   proxy) ;
4. la page : relit le profil (en-tête, accueil, profil).

Ensuite, par page (allers-retours en série après ces quatre ; estimations de lecture) :

| Page | Série dans la page | Enchaînements évitables |
| --- | --- | --- |
| Accueil (joueur) | ~4 : compétitions + ligues → ~10 lectures en parallèle → faits du jour | la 2e vague dépasse les 8 requêtes simultanées de `limitedFetch` : une vague de plus |
| Épreuve | ~5 : épreuve → cotes / utilisateur → ligues → mon prono → barème / joker | utilisateur avec l'épreuve ; ligues, mon prono et joker ensemble : 5 → 3 |
| Classement | ~4 : utilisateur → ligues → classements de ligue → classement général | utilisateur avec les compétitions ; classement général avec ceux des ligues : 4 → 2 |
| Ligue | ~3 : ligue → classement de la ligue → épreuves de la ligue | dépendent de la ligue : à regrouper seulement si c'est lent à l'usage |
| Manager | ~2 : ligue / saison / fil en parallèle → compétitions disponibles (créateur) | rien d'évident |
| Profil | ~3, mais des dizaines de lectures (une par compétition et par bloc) derrière 8 places | **pas de `loading.tsx`** : écran figé pendant le chargement |

## Décision : v0.20.3, dans cet ordre

1. **Préprod en Francfort (`fra1`)**, la prod reste en `lhr1`. Gain : environ 15 ms par
   aller-retour en préprod, soit le plus direct pour le propriétaire.
2. **Une nouvelle tentative sur « fetch failed »** dans `limitedFetch`, pour les lectures
   seulement (GET/HEAD), après une courte pause. Gain : plus de blocs vides ni de pages d'erreur
   sur une panne passagère.
3. **Une seule vérification de l'utilisateur par page** : la page reprend l'utilisateur vérifié
   par le proxy au lieu de rappeler le serveur d'auth, ou `auth.getClaims()` si le projet
   Supabase signe ses jetons avec des clés asymétriques. Gain : un aller-retour vers l'auth par
   page connectée.
4. **Épreuve et Classement en parallèle, squelette sur `/profil`**. Gain : deux allers-retours
   sur ces deux pages ; un profil qui s'affiche tout de suite.

Écartés pour l'instant, à rouvrir si la prod montre des pages lentes une fois en usage : fonctions
SQL qui regroupent les lectures (Ligue, Accueil, saison du profil), rendu en deux temps, index
(Supabase → Query Performance).
