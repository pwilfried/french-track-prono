# Fiches athlètes enrichies depuis Wikidata

Étude (spike) #895, 15 novembre 2026, après la décision du propriétaire du même jour :
Wikidata, et seulement Wikidata. Aucune ligne de code de production ; les essais ont été faits
depuis un runner GitHub Actions avec un script Python jetable, non commité. Il passait par l'API
de Wikidata (`wbsearchentities`, `wbgetentities`), en série, avec un `User-Agent` qui nomme le
projet et une pause d'au moins 0,5 s entre deux requêtes.

## Décision en une phrase

**Wikidata identifie presque tous nos athlètes mais connaît peu leurs marques.** On s'en sert pour
l'identité (élément Wikidata, date de naissance, disciplines, lien Wikipédia) et pour les records
personnels quand ils existent, avec la mention « Source : Wikidata ». On ne prend pas les
médailles, trop incomplètes. Les PB et SB de la saison restent ceux des résultats saisis par
l'admin.

## 1. Échantillon

Les 307 athlètes individuels du dépôt (`supabase/seed.sql` et
`supabase/data/european-championships-2026.sql`, sans doublon ; les 18 relais sont laissés de
côté). Ce sont les athlètes des Euros 2026 et de l'Ultimate Championship, donc plutôt connus :
**sur les fiches moins connues de la prod, la couverture sera plus basse**. La base de prod n'a
pas été lue (le runner n'y a pas accès).

## 2. Couverture mesurée

| Donnée | Propriété Wikidata | Athlètes | Part |
|---|---|---|---|
| Élément trouvé, sans ambiguïté (nom, pays, sexe) | `P31` = humain, `P641` = athlétisme (`Q542`) | 298 / 307 | 97 % |
| … dont le libellé est exactement notre nom | libellé `en` | 279 / 307 | 91 % |
| Date de naissance | `P569` | 298 / 298 | 100 % |
| Identifiant World Athletics | `P1146` | 298 / 298 | 100 % |
| Disciplines | `P2416` | 199 / 298 | 67 % |
| Article Wikipédia en français | lien `frwiki` | 209 / 298 | 70 % |
| **Au moins un record personnel** | `P2415` | **35 / 298** | **12 %** |
| … avec une marque de 2025 ou 2026 | qualificatif `P585` ou `P580` | 6 / 298 | 2 % |
| Participation à une compétition | `P1344` | 164 / 298 | 55 % |
| … avec au moins une médaille (rang 1 à 3 ou médaille) | qualificatifs `P1352`, `P166` | 81 / 298 | 27 % |

Les 9 athlètes restants : 4 introuvables, 3 avec deux candidats, 2 dont le pays ou le sexe ne
concorde pas (voir les pièges).

## 3. Forme des données

- **Record personnel** (`P2415`) : une quantité avec son unité (seconde `Q11574`, mètre `Q11573`,
  centimètre `Q174728`, point), et des qualificatifs : discipline (`P2416`), date (`P585`, ou
  `P580` pour le début d'une période), lieu (`P276`), caractéristique (`P1552` : record du monde,
  d'Europe…). Souvent, c'est **la progression d'un record** et non un seul PB : 6 déclarations
  pour la perche de Duplantis (6,20 m à 6,25 m), toutes de rang normal ; les anciennes portent
  une fin de validité (`P582`). Le PB actuel est la meilleure marque de la discipline, ou la
  déclaration de rang « préféré » quand il y en a une.
- **Pays** : `P1532` (pays sportif), sinon `P27` (nationalité) ; le code à trois lettres vient
  du code CIO du pays (`P984`), qui est aussi celui de `athletes.country_code` (ITA, SUI, NED).
- **Médailles** : `P1344` (participe à) vise une épreuve (« saut en hauteur masculin aux Jeux
  olympiques d'été de 2020 ») avec un rang (`P1352`) ou une médaille (`P166`). Les lignes sont
  très incomplètes : pour Tamberi, Wikidata n'a que 4 participations, sans le titre mondial 2023
  ni ses titres européens.

## 4. Pièges

- **Homonymes** : deux Attila Molnár hongrois, tous deux sprinteurs (nés en 1994 et 2002) ; une
  Jasmine Jones athlète et une Jasmine Jones bobeuse. La date de naissance départage, mais on
  ne l'a pas dans notre base : c'est l'admin qui choisit.
- **Faux candidats de la recherche** : « Kenny Bednarek » remonte aussi Jaylen Bacon (même pays,
  même sexe, sprinteur). Exiger que le libellé ou un alias soit notre nom (sans accents ni casse)
  l'écarte.
- **Changements de nom** : notre « Natalia Bukowiecka » est « Natalia Kaczmarek » dans Wikidata ;
  « Yemisi Mabry » y est « Yemisi Ogunleye », « Georgia Hunter Bell » y est « Georgia Bell ».
  Le bon élément est trouvé par les alias, mais le libellé diffère : à valider par l'admin.
- **Libellé absent en anglais** : 7 éléments n'ont pas de libellé `en` (seulement `fr`, `mul` ou
  la langue de l'athlète) : lire aussi `fr` et `mul`.
- **Pays** : Jeremiah Azu a pour pays sportif le pays de Galles (`Q25`), sans code CIO, alors qu'il
  court pour GBR : lire `P27` quand `P1532` n'a pas de code CIO.
- **Sexe** : un athlète non binaire dans Wikidata (`Q48270`) court dans une catégorie F ou M chez
  nous. Le sexe n'écarte un candidat que s'il est le contraire du nôtre.
- **Identifiant World Athletics** : parfois deux valeurs (ancien et nouvel identifiant IAAF).
- **Marques sans date** : 2 des 35 athlètes avec un PB n'ont aucune date sur leurs marques.
- **Données périmées** : seulement 6 PB datent de 2025 ou 2026. Un PB de Wikidata peut être
  battu depuis. On ne l'affiche donc jamais à la place d'un PB plus récent tiré de nos résultats.

## 5. Ce qu'on prend

| Donnée | On la prend | Affichage |
|---|---|---|
| Élément Wikidata (`Q…`) | oui, colonne `athletes.wikidata_id` (unique, facultative) | non (sert à relire) |
| Date de naissance | oui | l'âge (« 26 ans »), en tête de fiche |
| Disciplines (`P2416`) | oui, comme suggestion à l'admin quand l'athlète n'en a pas | non directement |
| Record personnel (`P2415`) | oui, le meilleur par discipline, avec sa date et son lieu | PB de la fiche, « Source : Wikidata » |
| Lien Wikipédia (`frwiki`, sinon `enwiki`) | oui | lien sortant « Wikipédia » |
| Identifiant World Athletics (`P1146`) | non (on ne lit rien chez World Athletics) | non |
| Médailles (`P1344`) | **non** : 27 % de couverture, des palmarès tronqués | non |
| Photo (`P18`) | **non** (non-objectif 7) | non |

Règle du PB de la fiche : la meilleure marque entre le PB tiré de nos résultats (ou saisi par
l'admin, `verified`) et celui de Wikidata. Un PB de Wikidata est rangé avec `kind = 'pr'` et une
source `wikidata` ; la fiche affiche « Source : Wikidata » sous le bloc qui l'utilise. Le SB
reste celui de nos résultats : Wikidata n'en a pas.

Les disciplines de Wikidata (« saut à la perche » `Q185027`…) se relient aux nôtres par une table
de correspondance écrite à la main dans le code (une vingtaine d'éléments), pas par le libellé.

## 6. Correspondance athlète ↔ élément

1. Recherche par le nom (`wbsearchentities`, en `en` puis `fr`, 10 résultats chacun).
2. On garde les humains (`P31` = `Q5`) liés à l'athlétisme (`P641` = `Q542`, ou métier
   d'athlète).
3. Le pays doit concorder (`P1532`, sinon `P27`, par le code CIO) ; le sexe ne doit pas être le
   contraire du nôtre.
4. **Sûr** quand il reste un seul candidat **et** que son libellé ou un alias est notre nom (sans
   accents ni casse) : 279 athlètes sur 307 (91 %). Il est enregistré tout seul.
5. **À valider** dans tous les autres cas (plusieurs candidats, nom différent, aucun candidat) :
   l'admin voit les candidats (nom, description, date de naissance, pays) dans le back-office,
   choisit, ou marque « pas dans Wikidata ». Jamais de choix automatique entre deux candidats.
6. Une fois posée (par la règle 4 ou par l'admin), la correspondance ne change plus d'elle-même ;
   seul l'admin peut la défaire.

## 7. Fréquence et débit

- **Workflow GitHub planifié, chaque semaine** (comme l'import des clubs) : la clé `service_role`
  reste dans les secrets, pas de limite de durée. Plus à la main depuis l'onglet Actions.
- **Athlètes déjà reliés** : `wbgetentities` par lots de 50 éléments, soit une dizaine de
  requêtes pour 500 athlètes. **Athlètes pas encore reliés** : deux recherches chacun, une fois ;
  ceux marqués « pas dans Wikidata » ne sont plus cherchés.
- Règles d'usage de Wikidata : `User-Agent` qui nomme le projet et donne un contact (le dépôt),
  requêtes en série, une par seconde au plus, paramètre `maxlag=5` (on attend et on réessaie quand
  les serveurs sont chargés). On n'utilise pas le service SPARQL : l'API suffit.
- Échec (réseau, format inconnu) : on garde les dernières valeurs et le workflow échoue en rouge,
  sans rien effacer.

## 8. Les 842 fiches non vérifiées de la prod

Ce sont des lignes de `athlete_records` avec `verified = false`, mises à jour jusqu'au
14 novembre 2026 hors du dépôt. Le spike n'a pas pu les lire. Proposition :

1. Quand Wikidata a un PB pour l'athlète et la discipline, il remplace la ligne non vérifiée
   (source `wikidata`).
2. Les PB et SB qu'on peut recalculer depuis nos propres résultats (`results`) sont recalculés
   (vérifiés par l'admin, puisque c'est lui qui saisit les résultats).
3. **Le reste est supprimé**, et la fiche montre « Pas encore de record » : ces marques ne
   viennent ni de l'admin, ni de nos résultats, ni de Wikidata. Si elles viennent de World
   Athletics, les garder reviendrait à constituer la base que ses conditions interdisent (3.1.1).
   Avec 12 % de PB dans Wikidata, la plupart des fiches peu connues n'auront donc plus de PB
   tant que l'admin ne l'a pas saisi.

## 9. Réalisation proposée (étape 2, une PR chacune)

1. **Base** : colonnes `athletes.wikidata_id`, `birth_date`, `wikipedia_url`,
   `wikidata_status` (`unknown`, `linked`, `to_review`, `absent`) ; table des candidats à valider ;
   colonne `athlete_records.source` (`admin`, `results`, `wikidata`) ; fonctions admin pour
   relier, défaire, marquer absent ; pgTAP (sécurité par ligne, un joueur n'écrit rien).
2. **Port `WikidataSource` + fake + adaptateur réel** : chercher des candidats, lire des éléments
   par lots ; règle de correspondance dans `src/domain/wikidata-match.ts` (tests : Molnár,
   Bednarek/Bacon, Kaczmarek/Bukowiecka, Azu, Hiltz) ; test de contrat sur le fake et sur
   Wikidata (sauté sans réseau).
3. **Script + workflow hebdomadaire** (`scripts/wikidata/`, `.github/workflows/wikidata.yml`) :
   le workflow doit être ajouté par le propriétaire (l'agent ne peut pas modifier
   `.github/workflows`).
4. **Back-office** : liste « À relier » dans `/admin/athletes`, avec les candidats ; e2e.
5. **Fiche athlète** : âge, PB de Wikidata avec « Source : Wikidata », lien Wikipédia ; story et
   e2e.
6. **Nettoyage des 842 fiches** (section 8), une fois les précédentes en prod.

## Questions au propriétaire

1. Supprimer les marques non vérifiées qui ne sont remplacées ni par Wikidata ni par nos
   résultats (section 8) ?
2. Afficher l'âge de l'athlète, tiré de sa date de naissance ?
