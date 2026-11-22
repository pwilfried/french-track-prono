# Communauté (v0.19)

Issue #612. Périmètre validé par le propriétaire le 13 novembre 2026, maquette « Communauté — fil
de ligue et Battez FrenchTrack » validée le même jour, feu vert et derniers choix le 14 novembre
2026. Ce document fixe les règles ; le code suit (#671 à #674, #766).

## Trois blocs

1. **Le fil de ma ligue** (#671), dans chaque ligue de pronos et chaque ligue Manager, à côté
   de Classement et Membres. L'app publie seule les moments marquants ; personne n'écrit.
   - Pronos : podium parfait, changement de 1re place, série de pronos qui rapportent.
   - Manager : enchère gagnée, publiée à la révélation du tour du mercato (jamais avant) ;
     résultat définitif d'une confrontation.
   - Les deux : nouveau badge.
2. **Les réactions** (#672) : emojis d'une liste fixe et messages prédéfinis (« Bien joué ! »,
   « Revanche ? »…). Pas de texte libre (non-objectif 6).
3. **« Battez FrenchTrack »** (#674) : sur les grandes finales, FrenchTrack publie son prono,
   caché jusqu'au verrouillage ; chacun voit s'il l'a battu ; classement de saison. Seul
   FrenchTrack lance ce défi : pas de défis entre joueurs.

Sur l'accueil, le bloc « Dans ma communauté » (#673) rassemble les derniers moments de mes
ligues, les **annonces FrenchTrack** et les **sondages**. Annonces et sondages sont publiés par
l'admin depuis le back-office : une annonce a un type (nouvel épisode avec lien d'écoute,
compétition qui ouvre, programme publié), un titre et un sous-titre courts ; un sondage a une
question, 2 à 4 réponses et une date de clôture, un vote par joueur, résultats après le vote.

## Ce que le fil montre des autres joueurs

Le **pseudo et le dossard**, comme dans les classements, et rien d'autre : ni e-mail, ni club, ni
profil complet. Un moment ne se lit que par les membres de la ligue.

## Modération

- Un joueur peut **signaler** une réaction ou un message sous un moment.
- L'**admin** voit les signalements dans le back-office et **masque** ce qui doit l'être ; un
  élément masqué disparaît pour tous. Les joueurs ne masquent rien eux-mêmes.
- Les annonces et sondages viennent de l'admin seul ; il peut les retirer.

## « Le saviez-vous ? » (#766)

Une **carte en haut de l'accueil** (variante A de la maquette) : un fait, une étiquette, « Un
autre », × la ferme jusqu'au lendemain. La fenêtre quotidienne (variante B) est abandonnée.
L'admin gère les faits et peut éteindre la carte.

## Livré en v0.19

- Fil de ligue (#671, #875) : les six moments prévus, publiés une seule fois par clé stable ;
  l'enchère gagnée n'apparaît qu'à la révélation du tour, le badge quand le joueur a vu sa
  célébration.
- Réactions (#672) : 🔥 👏 😮 😂 et cinq messages (« Bien joué ! », « Quel flair ! »,
  « Revanche ? », « Pas de chance », « Je te rattrape »), stockés comme des codes. « Signaler » est
  proposé sous chaque message (la base accepte aussi un emoji, l'interface ne le propose pas) ;
  l'admin traite les « Signalements du fil » depuis la page « Ligues » du back-office. Le joueur concerné reçoit une notification
  regroupée (famille « Ma ligue » de ses rappels, son interrupteur arrive avec #903).
- « Battez FrenchTrack » (#674, #877) : posé par l'admin depuis l'épreuve, calculé avec le même
  barème que les joueurs (sans joker de ligue), classement `/classement/frenchtrack` par année civile ; un
  défi calculé devient aussi un moment de « Dans ma communauté ».
- Accueil (#673, #896) : « Dans ma communauté » garde la dernière annonce, le dernier défi, le
  sondage ouvert et trois moments, « Tout voir » ouvre `/communaute`. L'annonce d'un nouvel
  épisode va dans la carte du podcast, pas dans ce bloc, pour ne pas l'afficher deux fois.
- « Le saviez-vous ? » (#766) : variante A, 48 faits de départ gérés depuis
  `/admin/le-saviez-vous`.

Le détail technique (tables, fonctions, règles) est dans `docs/architecture.md`.

## Écarté pour l'instant

Profils publics et abonnements, défis entre joueurs, texte libre.
