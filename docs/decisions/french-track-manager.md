# French Track Manager (F19)

« Recrute tes athlètes. Construis ton équipe. Domine la saison. »

Règles du cahier des charges fonctionnel du propriétaire, version 1.1 (phases 1 à 5 validées), mises
dans le dépôt le 9 novembre 2026. Elles remplacent les propositions du spike #62
(`ligues-saison-encheres.md`). Plan des versions : #415 ; questions : #416, #440, #441.

## Le jeu

Un mode de gestion d'équipe d'athlétisme dans French Track Prono. Chaque participant recrute son
équipe aux enchères secrètes, aligne une sélection avant chaque compétition, marque des points
avec les performances réelles de ses athlètes (barème hongrois), des bonus sportifs et ses
pronostics classiques, et affronte les autres dans un championnat aller-retour.

Le budget est en crédits virtuels, sans lien avec de l'argent réel : pas d'achat, pas de lot.

## 1. Ligue et règles (v0.12)

- Un joueur crée une ligue, en devient l'administrateur, choisit son nom et sa visibilité :
  **publique** (inscription libre dans la limite des places) ou **privée** (sur invitation du
  créateur). Il voit la liste des participants.
- **4 à 12 participants, en nombre pair.**
- L'**admin de French Track Prono** fixe les règles générales : budget initial, quotas de
  composition des équipes (ex. sprinteurs hommes et femmes, demi-fond, fond, lancers), règles de
  recrutement, notation, bonus sportifs, compétitions éligibles, calendrier, durée des enchères,
  clôture du mercato, règles d'alignement.
- Le créateur d'une ligue ne choisit pas les compétitions.
- Les règles sont **figées à la création** de la ligue : tous ses participants jouent avec les
  mêmes paramètres.
- Écrans : back-office › Manager pour les règles (#418) ; `/manager` pour les ligues, depuis
  « Mes ligues » (#419). Les ligues Manager ont leurs propres tables, à part des ligues de pronos.
- Les valeurs posées par la migration de #418 (budget 100, équipe
  de 12, alignement de 8, bonus…) sont un point de départ à ajuster par le propriétaire.

## 2. Mercato (v0.13)

- **Catalogue** : les athlètes de la base, avec nom, sexe, discipline, PB, SB, prix de référence et
  disponibilité.
- **Budget** : le même pour tous, fixé par l'admin. Le prix de référence est l'enchère minimale.
- **Enchères secrètes** : plusieurs athlètes à la fois, offres modifiables jusqu'à la clôture du
  tour, dans la limite du budget disponible. On ne voit que ses propres offres : ni celles des
  autres, ni leur nombre, ni sa position, ni la meilleure offre. La dernière offre compte.
- **Réservation** : une offre réserve son montant ; la somme des offres actives ne dépasse jamais
  le budget disponible ; une modification recalcule la réservation.
- **Attribution** à la clôture d'un tour : l'offre la plus haute gagne ; à égalité, celle
  enregistrée en premier à ce montant (horodatage précis, mis à jour à chaque modification). Le
  montant est déduit, les réservations perdantes libérées. Un athlète n'appartient qu'à une
  équipe de la ligue.
- **Tours** : 48 h pour les tours 1 et 2, 24 h ensuite.
- **Clôture du mercato**, de trois façons : plus aucun participant n'a de budget (après
  résolution des offres en cours) ; le dernier participant qui a encore du budget décide d'y
  mettre fin ; date programmée par les règles.
- **Complément automatique** à la clôture : une équipe incomplète reçoit au hasard des athlètes
  encore libres, dans le respect des quotas et du budget restant, au prix de référence, jusqu'à
  être complète, à budget épuisé ou sans athlète éligible abordable. Une équipe qui respecte les
  quotas minimums est validée, sinon signalée « non conforme ». La clôture est collective : la
  situation de tous est vérifiée avant de finaliser.

## 3. Équipe et alignement (v0.14)

- Après le mercato, l'équipe est **fixe pour la saison** : en version 1, ni achat, ni vente, ni
  échange, ni remplacement.
- **Avant chaque compétition éligible**, le participant aligne une sélection de son équipe,
  modifiable d'une compétition à l'autre, selon les règles de l'admin : minimum par famille de
  disciplines (sprint, demi-fond, fond, sauts, lancers…), maximum total, compatibilité athlète /
  discipline.
- La sélection est validée avant le début de la compétition (athlètes de son équipe, chacun une
  fois, quotas et maximum respectés), puis **verrouillée** au début. Sans sélection validée :
  **0 point** pour la compétition.
- Pas de mercato secondaire payant : le budget reste en crédits virtuels (#416).

## 4. Points (v0.15)

**Score d'une compétition = points du barème hongrois + bonus sportifs + points de pronostics.**

- **Barème hongrois** : chaque athlète aligné rapporte des points selon sa performance réelle ;
  la place n'entre pas dans ce calcul. Tables World Athletics (#428) ; DNS, DNF, DQ = 0 point.
- **Bonus sportifs**, tous cumulables, valeurs fixées par l'admin : 1re, 2e, 3e place, record
  personnel, meilleure performance de la saison, record national, continental et du monde.
- **Saisie** : l'admin entre places, performances et indicateurs de records ; le calcul est
  automatique.
- **Pronostics classiques obligatoires** sur toutes les épreuves de chaque compétition éligible,
  verrouillés au départ ;
  sans pronostic, 0 sur cette partie.

## 5. Championnat (v0.16)

- **Aller-retour** : chaque participant affronte tous les autres deux fois, à domicile puis à
  l'extérieur ; calendrier généré au lancement de la saison, fixe ensuite.
- **Une confrontation par compétition éligible** : le score total le plus haut gagne, égalité =
  nul. **Victoire 3 points, nul 1, défaite 0** (distincts des points Manager).
- **Classement** : points au championnat, puis victoires, puis différence de points Manager
  (marqués moins encaissés), puis points Manager marqués.
- **Fin de saison** quand toutes les confrontations sont jouées et validées, sans playoffs : le
  premier est champion, le classement est figé.
- **Palmarès** conservé : champion, classement final, statistiques individuelles, victoires / nuls
  / défaites, points Manager marqués, historique des confrontations directes.

## Réponses du propriétaire (#416, 10 novembre 2026)

- **DNS, DNF, DQ**, performance invalide ou résultat officiel manquant : l'athlète reste aligné et
  rapporte **0 point**.
- **Résultat corrigé** après la première saisie : **recalcul complet** du score de la compétition,
  des confrontations déjà jouées et du classement.
- **Clôture du mercato** : l'**admin de la ligue** choisit la date et le mode de clôture parmi
  ceux que l'admin de French Track Prono autorise.
- **Barème hongrois** : tables de cotation **World Athletics**. Le droit de les embarquer dans
  l'app reste à vérifier dans #428.
- **Saisie des performances** : au minimum celles des athlètes alignés par au moins un
  participant ; l'admin peut aussi saisir tous les résultats de la compétition pour qu'ils
  soient visibles dans l'app.
- **Pronostics obligatoires** : ceux de **toutes les épreuves** pronostiquables de la compétition.
- **Monnaie** : crédits virtuels uniquement, rien de payant. Le mercato secondaire payant est hors
  périmètre.

## Questions encore ouvertes

- Compétitions éligibles face aux 2 × (n − 1) journées d'un aller-retour : #440 (bloque #432).
- Prix de référence fixé à la main ou calculé : #441 (bloque #421).
