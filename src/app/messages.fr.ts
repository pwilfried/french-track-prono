// Every visible UI string lives here (French only in v1, no i18n library).

import { eventLabel } from "@/domain/event-label";
import type { ManagerIntroFigures } from "@/domain/manager-intro";

/** « 1er », « 2e »… */
const ordinal = (rank: number) => (rank === 1 ? "1er" : `${rank}e`);
/**
 * Points, written one way everywhere (docs/DESIGN.md, « Points », #706): the short unit
 * « 1 pt / 12 pts » in tight places, the full word « 1 point / 12 points » in sentences.
 */
const ptsUnit = (n: number) => (Math.abs(n) <= 1 ? "pt" : "pts");
const pts = (n: number) => `${n} ${ptsUnit(n)}`;
/** Points won, signed when positive: « +9 pts », « 0 pt ». */
const gain = (n: number) => (n > 0 ? `+${pts(n)}` : pts(n));
const pointsWord = (n: number) => (Math.abs(n) <= 1 ? "point" : "points");
const points = (n: number) => `${n} ${pointsWord(n)}`;
const GENDER = { F: "Femmes", M: "Hommes", X: "Mixte" } as const;
/** The contact address published on the site: written here only. */
const CONTACT_EMAIL = "frenchtrackprono@gmail.com";
/** Competition levels with a name of their own (#647). */
const LEVEL_NAMES: Record<string, string | undefined> = {
  championnat: "Championnat",
  "diamond-league": "Diamond League",
  "world-indoor-tour-gold": "World Indoor Tour Gold",
};

export const messages = {
  /** The only way to write points (#706). */
  format: { pts, ptsUnit, gain, points, pointsWord },
  /** Name and place of each competition the app can show (see src/app/competition.ts). */
  competition: {
    /**
     * « 11 sept. 2026 », « 11–13 sept. 2026 », « 30 sept. – 2 oct. 2026 »,
     * « 28 déc. 2026 – 3 janv. 2027 » (#707): the month and the year are written once.
     */
    dates: (from: string, to: string) => {
      const day = (d: string) => String(Number(d.slice(8, 10)));
      const month = (d: string) =>
        new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", {
          month: "short",
          timeZone: "UTC",
        });
      const year = (d: string) => d.slice(0, 4);
      const full = (d: string) => `${day(d)} ${month(d)} ${year(d)}`;
      if (from === to) return full(from);
      if (year(from) !== year(to)) return `${full(from)} – ${full(to)}`;
      if (from.slice(5, 7) !== to.slice(5, 7)) return `${day(from)} ${month(from)} – ${full(to)}`;
      return `${day(from)}–${full(to)}`;
    },
  },
  app: {
    name: "French Track Prono",
    short: "FTP",
    home: "French Track Prono, accueil",
    skipToContent: "Aller au contenu",
    tagline: "Pronostique les podiums d'athlétisme, chambre tes amis, grimpe au classement.",
    description: "Le jeu de pronostics d'athlétisme de la communauté FrenchTrack.",
  },
  nav: {
    label: "Navigation principale",
    home: "Accueil",
    events: "Compétitions",
    ranking: "Classement",
    league: "Ma ligue",
    leagues: "Ligues",
    manager: "Manager",
  },
  home: {
    current: "Compétition en cours",
    upcoming: "Prochaine compétition",
    in: "Dans",
    days: "j",
    hours: "h",
    minutes: "min",
    countdownLabel: (days: number, hours: number, minutes: number) =>
      `Prochain verrouillage dans ${days} jours, ${hours} heures et ${minutes} minutes`,
    compose: "Composer mon podium",
    seeAll: (count: number) => `Voir les ${count} épreuves`,
    myRank: "Ton rang général",
    players: (count: number) => (count <= 1 ? `sur ${count} joueur` : `sur ${count} joueurs`),
    notRanked: "Pas encore classé : fais ton premier prono.",
    nextEvents: "Prochaines épreuves",
    noneOpen: "Plus aucune épreuve ouverte aux pronos.",
  },
  clubNotices: {
    validated: (club: string) =>
      `Ton club « ${club} » est validé : les autres joueurs le voient sur ta fiche.`,
    renamed: (club: string, name: string) =>
      `Ton club « ${club} » s'appelle maintenant « ${name} ».`,
    removed: (club: string) =>
      `Le club « ${club} » a été retiré de la liste. Choisis ton club dans ton profil.`,
    merged: (club: string, name: string) =>
      `Ton club « ${club} » existait déjà : tu es maintenant au club « ${name} ».`,
    dismiss: "OK",
    dismissing: "En cours…",
  },
  playerHome: {
    /** « Bienvenue » until a first prediction, then « Salut » (#526). */
    hello: (pseudo: string, isNew: boolean) => (isNew ? `Bienvenue, ${pseudo}` : `Salut ${pseudo}`),
    action: {
      label: "Ta prochaine action",
      yourTurn: "À toi de jouer",
      firstPrediction: "Ton premier prono",
      locksIn: (duration: string) => `Verrouille dans ${duration}`,
      startsAt: (day: string, time: string) =>
        `Départ ${day} à ${time} (heure de Paris). Choisis ton 1er, ton 2e et ton 3e avant le verrou.`,
      play: "Faire mon podium",
      sameDay: (count: number) =>
        count === 1 ? "1 autre finale ce soir" : `${count} autres finales ce soir`,
      nextCompetition: "Prochaine compétition",
      finals: (count: number) => (count <= 1 ? `${count} finale` : `${count} finales`),
      programme: "Voir le programme",
    },
    league: {
      title: "Ma ligue",
      emptyTitle: "C'est entre amis que ça se joue",
      emptyText:
        "Crée ta ligue, partage le code, et regarde le classement bouger après chaque finale.",
      create: "Créer ma ligue",
      joinPublic: "Ou rejoindre une ligue publique",
      place: (rank: number, total: number) => `${ordinal(rank)} sur ${total}`,
      gap: (gap: number, pseudo: string) => `À ${points(gap)} de ${pseudo}`,
      leading: "Tu es en tête",
      ranking: "Classement",
    },
    lastResult: {
      title: "Dernier résultat",
      /** « 2 athlètes bien placées », in the gender of the event. */
      detail: (exact: number, onPodium: number, gender: "F" | "M" | "X") => {
        const e = gender === "F" ? "e" : "";
        const athletes = (n: number) => `${n} athlète${n > 1 ? "s" : ""}`;
        if (exact > 0) return `${athletes(exact)} bien placé${e}${exact > 1 ? "s" : ""}`;
        if (onPodium > 0) return `${athletes(onPodium)} sur le podium`;
        return gender === "F" ? "Aucune athlète sur le podium" : "Aucun athlète sur le podium";
      },
      points: (n: number) => `+${pts(n)}`,
      see: "Voir le résultat",
    },
    manager: {
      mercato: "Le mercato est ouvert : place tes offres avant la fin du tour.",
      open: "Ouvrir le Manager",
    },
    /** The card asking an incomplete profile to be completed (#540). */
    completeProfile: {
      firstPodium: "Ton premier podium est posé !",
      title: "Complète ton profil",
      text: "Ton club apparaît à côté de ton pseudo. Tes disciplines restent visibles par toi seul.",
      later: "Plus tard",
      laterLabel: "Plus tard : masquer pendant 30 jours",
      familiesLabel: "Tes disciplines",
      family: {
        sprint: "Sprint",
        hurdles: "Haies",
        middle_distance: "Demi-fond",
        jumps: "Sauts",
        throws: "Lancers",
        combined: "Épreuves combinées",
      },
      precise: "Préciser les épreuves",
      save: "Enregistrer",
      saving: "Enregistrement…",
    },
    frenchTrack: {
      title: "Le podcast FrenchTrack",
      text: "Les analyses et les invités avant chaque grand rendez-vous, et l'actu sur nos réseaux.",
      listen: "Écouter le dernier épisode",
    },
  },
  visitorHome: {
    eyebrow: "Pronostics d'athlétisme",
    title: "Devine le podium. Bats tes amis.",
    intro:
      "Avant chaque finale, tu choisis le 1er, le 2e et le 3e. Plus tu vises juste, plus tu marques de points.",
    play: "Faire mon premier prono",
    free: "Gratuit, sans argent en jeu. Un e-mail suffit pour jouer.",
    nextTitle: "Prochaine compétition",
    seeEvents: "Voir les épreuves",
    friendsTitle: "Encore mieux entre amis",
    friends:
      "Crée une ligue, partage le code, et regarde le classement bouger après chaque finale.",
    createLeague: "Créer une ligue",
  },
  /** The three steps, on the visitor's home and on the player's until a first prediction. */
  howItWorks: {
    title: "Comment ça marche",
    steps: (exact: number, perfect: number) => [
      {
        title: "Choisis une finale",
        text: "Chaque épreuve affiche son compte à rebours avant le départ.",
      },
      {
        title: "Compose ton podium",
        text: "Trois taps : 1er, 2e, 3e. Tu peux changer d'avis jusqu'au départ.",
      },
      {
        title: "Marque des points",
        text: `${exact} point${exact > 1 ? "s" : ""} par athlète à la bonne place, ${perfect} pour le podium parfait.`,
      },
    ],
    dismiss: "Masquer « Comment ça marche »",
  },
  start: {
    none: "Aucune compétition à venir pour l'instant.",
    inDays: (days: number) => (days === 0 ? "En cours" : days === 1 ? "Demain" : `Dans ${days} j`),
    events: (count: number) => (count <= 1 ? `${count} épreuve` : `${count} épreuves`),
  },
  events: {
    filtersLabel: "Filtrer les épreuves",
    filters: { todo: "À faire", posed: "Posés", done: "Terminées", all: "Toutes" },
    gender: GENDER,
    /** « 100 m femmes », « Relais mixte 4x100 m » (never the gender twice). */
    name: (discipline: string, gender: keyof typeof GENDER) =>
      eventLabel(discipline, GENDER[gender]),
    status: { upcoming: "À venir", live: "En cours", finished: "Terminé" },
    featured: "Phare",
    posed: "✓ Posé",
    addPrediction: "+ Prono",
    locksIn: (duration: string) => `Verrouille dans ${duration}`,
    locksOn: (day: string, hour: string) => `Verrouille le ${day} à ${hour}`,
    editable: "modifiable",
    perfect: "Podium parfait !",
    notPlayed: "Pas joué",
    /** « 100 m femmes, 20:35 ». */
    cardLabel: (name: string, hour: string) => `${name}, ${hour}`,
    empty: "Aucune épreuve pour ce filtre.",
    allPosed: "Tout est posé pour l'instant.",
    loading: "Chargement des épreuves…",
  },
  /** The « Compétitions » tab (#659): one competition, its days, its events by session. */
  competitions: {
    label: "Compétition",
    change: "Changer",
    changeLabel: (name: string) => `Changer de compétition (${name} affichée)`,
    noProgram: "programme à venir",
    sheet: {
      title: "Choisir une compétition",
      close: "Fermer",
      search: "Rechercher une compétition ou une ville",
      scopeLabel: "Type de compétition",
      scope: { all: "Toutes", international: "Internationales", france: "France" },
      mine: "Dans mes ligues",
      past: "Terminées",
      none: "Aucune compétition ne correspond.",
      france: "France",
      shown: "affichée",
    },
    month: (month: string) =>
      new Date(`${month}-15T12:00:00Z`).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    days: {
      label: "Jours de la compétition",
      today: "AUJ.",
      todayLabel: "aujourd'hui",
      doneLabel: "terminé",
    },
    sessions: { morning: "Matin", afternoon: "Après-midi", evening: "Soir" },
    progress: {
      label: "Ma progression",
      todo: (n: number) => `${n} à pronostiquer`,
      todoLabel: (n: number) => `${n} ${n <= 1 ? "épreuve" : "épreuves"} à pronostiquer ce jour`,
      posed: (posed: number, total: number) => `${posed}/${total} posés`,
      posedLabel: (posed: number, total: number) =>
        `${posed} ${posed <= 1 ? "podium posé" : "podiums posés"} sur ${total} dans la compétition`,
      points: pts,
      pointsLabel: (n: number) => `${points(n)} gagnés`,
    },
    emptyDay: "Aucune épreuve ce jour-là.",
    pending: {
      title: "Le programme n'est pas encore publié",
      text: "Les épreuves arrivent dès que l'organisateur publie l'horaire.",
      startsIn: (days: number) =>
        days === 0
          ? "Ça commence aujourd'hui"
          : days === 1
            ? "Début demain"
            : `Début dans ${days} jours`,
      notify: "Me prévenir à la publication",
      notified: "Tu seras prévenu",
      saving: "Enregistrement en cours…",
      notifiedHint: "Touche à nouveau pour ne plus être prévenu.",
      signIn: "Connecte-toi pour être prévenu",
      deviceHint:
        "La notification arrive sur les appareils où tu as activé les notifications (profil).",
      error: "Impossible d'enregistrer pour le moment. Réessaie dans un instant.",
      seeLive: "Voir une compétition en cours",
    },
  },
  leaderboard: {
    change: (n: number) =>
      n > 0
        ? `gagne ${n} ${n === 1 ? "place" : "places"}`
        : n < 0
          ? `perd ${-n} ${n === -1 ? "place" : "places"}`
          : "garde sa place",
    label: "Classement",
    podium: "Podium",
    podiumPlace: (rank: number, pseudo: string, total: number) =>
      `${ordinal(rank)} : ${pseudo}, ${points(total)}`,
    me: "Toi",
    tie: "ex æquo",
    position: (rank: number) => ordinal(rank),
    points,
    perfect: (n: number) => (n === 1 ? "1 podium parfait" : `${n} podiums parfaits`),
    winners: (n: number) => (n === 1 ? "1 vainqueur trouvé" : `${n} vainqueurs trouvés`),
    /** Header of the points column, so the column can show bare figures (#706). */
    pointsColumn: "Pts",
    empty: "Pas encore de classement : il apparaît dès que les premiers résultats sont saisis.",
    loading: "Chargement du classement…",
    error: "Le classement n'est pas disponible pour le moment. Réessaie dans un instant.",
  },
  playerCard: {
    open: (pseudo: string) => `Voir la fiche de ${pseudo}`,
    label: (pseudo: string) => `Fiche de ${pseudo}`,
    pseudo: "Pseudo",
    club: "Club",
    noClub: "Club non renseigné",
    rank: "Rang",
    rankOf: (rank: number, total: number) =>
      `${ordinal(rank)} sur ${total} ${total <= 1 ? "joueur" : "joueurs"}`,
  },
  points: {
    title: "Mes points",
    total: (points: number, events: number) =>
      `${pointsWord(points)} · ${events} ${events === 1 ? "épreuve" : "épreuves"}`,
    line: (points: number) => gain(points),
    emptyTitle: "Pas encore de points",
    emptyText: "Fais tes pronos : tes points apparaîtront ici dès que les résultats seront saisis.",
    seeEvents: "Voir les épreuves",
    note: "Les points arrivent quand l'admin a saisi le résultat.",
    profileLink: "Mes points",
    leaguesLink: "Mes ligues",
    reasons: {
      winner: "Vainqueur trouvé",
      second: "2e trouvé",
      third: "3e trouvé",
      misplaced: (count: number) =>
        count === 1 ? "1 athlète mal placé" : `${count} athlètes mal placés`,
      perfect: "Podium parfait",
      flair: "Coup de flair",
      odds: (points: number) => `Cotes +${points}`,
      marks: (points: number) => `Perf juste +${points}`,
      joker: "Joker ×2",
      none: "Aucun athlète sur le podium",
    },
  },
  manager: {
    title: "French Track Manager",
    slogan: "Recrute tes athlètes. Construis ton équipe. Domine la saison.",
    back: "French Track Manager",
    mine: "Mes ligues Manager",
    create: "Créer une ligue Manager",
    createTitle: "Créer une ligue Manager",
    createSubtitle: "Tu en deviens l'administrateur.",
    rulesNote:
      "Les règles (budget, quotas, alignement) sont celles de French Track Prono au moment de la création, et ne changent plus ensuite.",
    nameLabel: "Nom de la ligue",
    nameHint: "2 à 40 caractères.",
    publicLabel: "Ligue publique",
    publicHint: "Tout joueur peut s'inscrire tant qu'il reste des places. Sinon, sur invitation.",
    creating: "Création…",
    submit: "Créer la ligue",
    publicBadge: "Publique",
    privateBadge: "Privée",
    participantsCount: (n: number, target: number) => `${n} / ${target} participants`,
    adminBadge: "admin",
    participants: "Participants",
    ready: "Tout le monde est là : le mercato peut être lancé.",
    awaited: (n: number) => (n <= 1 ? "Encore 1 joueur attendu." : `Encore ${n} joueurs attendus.`),
    opensAt: (when: string) =>
      `Le mercato s'ouvrira le ${when} (heure de Paris) si tous les joueurs sont là ; sinon il attendra.`,
    mercatoOpened: (when: string) => `Mercato ouvert depuis le ${when} (heure de Paris).`,
    /** An instant in Paris time: « samedi 10 janvier à 20:00 ». */
    when: (iso: string) =>
      new Date(iso).toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }),
    inviteTitle: "Inviter des amis",
    mercatoTitle: "Régler le mercato",
    mercatoHint: "Seul le créateur règle le mercato, jusqu'à son lancement.",
    competitionsLabel: "Compétitions de la saison",
    competitionsHint:
      "Au moins 6, parmi celles qui ne sont pas terminées. Le championnat est un aller-retour : le nombre de joueurs en découle.",
    competitionsNone:
      "Il n'y a pas encore 6 compétitions disponibles : reviens quand le calendrier sera complété.",
    competitionsEditLabel: "Compétitions de la saison",
    competitionsEditHint:
      "Tu peux en ajouter ou en retirer jusqu'au lancement du mercato. Le nombre de joueurs suit, jamais sous le nombre d'inscrits.",
    /** « 8 compétitions → 4 joueurs · 6 journées + 2 bonus » (aller-retour, #663). */
    seasonFormat: (competitions: number, players: number, duelDays: number, bonusDays: number) =>
      `${competitions} compétitions → ${players} joueurs · ${duelDays} journées${bonusDays > 0 ? ` + ${bonusDays} bonus` : ""}`,
    /** How to land exactly, under the format (#663). */
    seasonMore: (missing: number, players: number) =>
      `Encore ${missing} pour passer à ${players} joueurs.`,
    seasonTrim: (bonus: number) => `Retires-en ${bonus} pour un aller-retour sans bonus.`,
    seasonCap: (players: number) => `${players} joueurs au plus.`,
    seasonTooFew: (competitions: number) =>
      `${competitions} ${competitions <= 1 ? "compétition" : "compétitions"} : il en faut au moins 6.`,
    saveCompetitions: "Enregistrer les compétitions",
    competitionsSaved: "Compétitions enregistrées.",
    /** The custom mercato ends less than 1 hour before the first competition. */
    seasonMissed: (missed: string, when: string, next: string | null) =>
      `Ton mercato finira après le début de ${missed} (le ${when}). Elle ne comptera pas${next ? ` : la saison commencera à ${next}` : ""}.`,
    seasonShort:
      "Il ne reste plus assez de compétitions pour l'aller-retour : ajoute une compétition ou raccourcis le mercato pour pouvoir le lancer.",
    startsAtLabel: "Début du mercato (heure de Paris)",
    startsAtHint:
      "Le mercato s'ouvre à cette heure si et seulement si tous les joueurs sont là. Laisse vide pour le lancer toi-même.",
    roundsLabel: "Durée des tours",
    roundsAuto: (hours: number) => `Automatique · règles French Track (${hours} h)`,
    roundsCustom: "Personnalisé",
    firstRoundLabel: "1er tour",
    nextRoundsLabel: "Tours suivants",
    hours: (n: number) => `${n} h`,
    calendarTitle: "Calendrier des tours",
    calendarRound: (n: number, hours: number) => `Tour ${n} · ${hours} h`,
    calendarEnds: (when: string) => `jusqu'au ${when}`,
    saveMercato: "Enregistrer les réglages",
    savingMercato: "Enregistrement…",
    mercatoSaved: "Réglages enregistrés.",
    launch: "Lancer le mercato maintenant",
    launching: "Lancement…",
    launchWaiting: (n: number) =>
      n <= 1 ? "Encore 1 joueur attendu" : `Encore ${n} joueurs attendus`,
    rules: "Règles de la ligue",
    budget: (n: number) => `${n} crédits de budget`,
    minTeamSize: (n: number) => `Équipes d'au moins ${n} athlètes, sans maximum`,
    lineup: (n: number) => `${n} athlètes alignés au plus par compétition`,
    competitions: (n: number) =>
      `${n} ${n <= 1 ? "compétition éligible" : "compétitions éligibles"}`,
    /** A day in Paris time: « samedi 10 janvier ». */
    day: (iso: string) =>
      new Date(iso).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      }),
    publicTitle: "Ligues publiques",
    publicEmpty: "Aucune ligue publique avec des places libres pour l'instant.",
    publicNoOther: "Pas d'autre ligue publique avec des places libres pour l'instant.",
    joinLeague: (name: string) => `Rejoindre la ligue ${name}`,
    join: "Rejoindre",
    joining: "…",
    joinWithCode: "Rejoindre avec un code",
    joinTitle: "Rejoindre une ligue Manager",
    joinSubtitle: "Avec le code ou le lien reçu du créateur.",
    codeLabel: "Code d'invitation",
    codeHint: "6 caractères, par exemple K7M 2QX.",
    joinSubmit: "Rejoindre la ligue",
    shareText: (name: string) => `Rejoins ma ligue French Track Manager « ${name} »`,
    catalogueLink: "Catalogue du mercato",
    /** The presentation of the mode, until the player has a Manager league (#618). */
    intro: {
      eyebrow: "Nouveau mode de jeu",
      tagline:
        "Deviens manager : recrute tes athlètes, aligne-les à chaque compétition et affronte tes amis toute la saison.",
      stepsLabel: "Le Manager en 5 étapes",
      steps: (f: ManagerIntroFigures) => [
        {
          title: "Recrute au mercato",
          text: `${f.budget} crédits pour recruter au moins ${f.minTeamSize} athlètes, par enchères secrètes.`,
        },
        {
          title: "Garde ton équipe toute la saison",
          text: "Tes athlètes restent avec toi jusqu'à la dernière compétition.",
        },
        {
          title: "Aligne tes titulaires",
          text: `Avant chaque compétition, choisis jusqu'à ${f.lineupMax} athlètes.`,
        },
        {
          title: "Marque des points",
          text: `Barème World Athletics, bonus sportifs (+${f.winBonus} pour une victoire) et tes pronos.`,
        },
        {
          title: "Gagne le championnat",
          text: "Affronte chaque participant deux fois, en confrontations aller-retour.",
        },
      ],
      create: "Créer une ligue Manager",
      haveCode: "J'ai un code d'invitation",
      skip: "Passer",
      skipLabel: "Passer la présentation",
    },
    /** The tutorial (#616): seven short steps, at the first visit then on demand. */
    tutorial: {
      label: "Comment ça marche",
      progress: (step: number, total: number) => `Comment ça marche · ${step} / ${total}`,
      stepLabel: (step: number, total: number) => `Étape ${step} sur ${total}`,
      skip: "Passer",
      skipLabel: "Passer le tutoriel",
      navLabel: "Étapes du tutoriel",
      previous: "Précédent",
      next: "Suivant",
      done: "C'est parti",
      open: "Comment ça marche ?",
      steps: (f: ManagerIntroFigures) => [
        {
          title: "Une ligue entre amis",
          text: `Crée ta ligue ou rejoins celle d'un ami. Le créateur choisit au moins ${f.minCompetitions} compétitions : elles fixent le nombre de joueurs, de ${f.leagueMin} à ${f.leagueMax}. Les règles sont les mêmes pour tous.`,
        },
        {
          title: "Le mercato",
          text: `Tu as ${f.budget} crédits pour recruter. Les offres sont secrètes : à la fin de chaque tour, les cartes se retournent et les enchères sont dévoilées.`,
        },
        {
          title: "Ton équipe pour la saison",
          text: `Au moins ${f.minTeamSize} athlètes, gardés jusqu'à la dernière compétition. Pas d'achat ni de vente en cours de route.`,
        },
        {
          title: "Aligne tes titulaires",
          text: `Avant chaque compétition, place jusqu'à ${f.lineupMax} titulaires au stade, sur les places de leur famille ou les places libres. Les autres restent remplaçants.`,
        },
        {
          title: "Marque des points",
          text: `Tes titulaires marquent selon le barème World Athletics, plus les bonus sportifs (+${f.winBonus} pour une victoire). Tes pronos de la compétition comptent aussi.`,
        },
        {
          title: "Une confrontation par journée",
          text: "Une compétition = une journée : tu affrontes un autre joueur, victoire 3 points, nul 1, défaite 0. Tu joues chacun deux fois, à l'aller et au retour. Les compétitions en trop, à la fin, sont des journées bonus : des points, sans confrontation.",
        },
        {
          title: "Deviens champion",
          text: "Après la dernière journée, bonus comprises, le premier du classement est champion. Ton palmarès reste dans ton profil.",
        },
      ],
    },
  },
  catalogue: {
    title: "Catalogue du mercato",
    subtitle: "Les athlètes à recruter, avec leur prix de départ.",
    search: "Rechercher un athlète",
    searchPlaceholder: "Nom, pays ou discipline",
    filters: "Filtres du catalogue",
    all: "Tous",
    sexes: { F: "Femmes", M: "Hommes" },
    sexShort: { F: "F", M: "H" },
    availableOnly: "Libres",
    found: (n: number) => (n <= 1 ? `${n} athlète` : `${n} athlètes`),
    empty: "Aucun athlète ne correspond.",
    emptyCatalogue: "Le catalogue est vide : l'admin n'a encore donné de prix à aucun athlète.",
    pb: "PB",
    sb: "SB",
    price: (n: number) => `${n} cr.`,
    priceLabel: (n: number) => `Prix de départ : ${n} crédits`,
    taken: "Recruté",
    previous: "‹ Précédents",
    next: "Suivants ›",
    page: (page: number, of: number) => `Page ${page} sur ${of}`,
    budgetTitle: "Mon budget",
    budget: "Budget",
    spent: "Dépensé",
    reserved: "Réservé",
    left: "Disponible",
    roundEndsIn: "Fin du tour dans",
    myTeam: "Mes athlètes",
    noTeam: "Aucun athlète remporté pour l'instant.",
    wonIn: (round: number) => `tour ${round}`,
    secret:
      "Tes offres restent secrètes jusqu'à la fin du tour : les autres participants ne voient ni tes offres, ni leur nombre. Puis toutes les offres du tour sont révélées. La dernière offre compte.",
    myBids: "Mes offres",
    noBids: "Aucune offre pour l'instant.",
    beforeMercato: "Avant le mercato",
    opensIn: "Ouverture dans",
    opensLater: "Date d'ouverture à venir",
    participants: (n: number) => (n <= 1 ? `${n} participant` : `${n} participants`),
    justJoined: (pseudo: string) => `${pseudo} vient de rejoindre la ligue`,
    prepare: "Prépare tes choix : les enchères s'ouvrent au lancement.",
    mercatoOver: "Le mercato de cette ligue est clos : les équipes sont faites.",
    lastBidder:
      "Plus personne d'autre ne peut recruter : tu peux clore le mercato. Tes offres en cours seront traitées, puis le mercato sera clos pour tout le monde.",
    closeMercato: "Clore le mercato",
    closing: "Clôture…",
    myBid: (n: number) => `Mon offre : ${n} cr.`,
    bidLabel: (name: string) => `Mon offre sur ${name}, en crédits`,
    less: "Baisser mon offre d'un crédit",
    more: "Monter mon offre d'un crédit",
    bid: "Enchérir",
    change: "Modifier",
    confirm: "Valider",
    cancel: "Annuler",
    withdraw: "Retirer",
    bidding: "…",
  },
  roundReveal: {
    title: "L'heure de vérité",
    subtitle: (round: number) => `Fin du tour ${round} : tes offres`,
    hiddenLabel: "Offre cachée",
    yourBid: (n: number) => `Ton offre : ${n} cr`,
    won: "GAGNÉ",
    lost: "PERDU",
    wonLine: (n: number) => `${n} crédits · à toi pour la saison`,
    lostLine: (pseudo: string, n: number) => `${pseudo} l'a eu à ${n} cr`,
    cardLabel: (name: string, won: boolean) => `${name} : ${won ? "gagné" : "perdu"}`,
    revealNext: "Révéler la suivante",
    revealAll: "Tout révéler",
    noBid: "Tu n'as fait aucune offre pendant ce tour.",
    tally: "Mon bilan du tour",
    tallyWon: "Offres gagnées",
    tallyAthletes: "Athlètes",
    tallyLeft: "Crédits restants",
    ratio: (n: number, of: number) => `${n}/${of}`,
    seeAll: "Voir toutes les enchères du tour",
    allTitle: (round: number) => `Toutes les enchères du tour ${round}`,
    offers: (n: number) => (n <= 1 ? "seule offre" : `${n} offres`),
    empty: "Personne n'a fait d'offre pendant ce tour.",
    backToMercato: "Retour au mercato · tour suivant",
    seeTeam: "Voir mon équipe",
    roundsTitle: "Résultats des tours",
    roundLink: (round: number) => `Tour ${round}`,
  },
  team: {
    title: "Mon équipe",
    subtitle: "Tes athlètes pour toute la saison.",
    link: "Mon équipe",
    summary: "Résumé de mon équipe",
    athletes: "Effectif",
    count: (n: number) => (n <= 1 ? `${n} athlète` : `${n} athlètes`),
    spent: "Crédits dépensés",
    left: "Crédits restants",
    fixed: "Équipe fixe pour la saison",
    notFixed: "Le mercato n'est pas fini : ton équipe peut encore changer.",
    empty: "Aucun athlète dans ton équipe pour l'instant.",
    groups: {
      sprint: "Sprint et haies",
      middle: "Demi-fond",
      long: "Fond",
      jumps: "Sauts",
      throws: "Lancers",
      combined: "Épreuves combinées",
    },
    codes: {
      sprint: "SPR",
      middle: "DEM",
      long: "FON",
      jumps: "SAU",
      throws: "LAN",
      combined: "COM",
    },
    /** « aucune lanceuse », « aucun sprinteur »: what was missing at the end of the mercato. */
    nobody: {
      F: {
        sprint: "aucune sprinteuse",
        hurdles: "aucune hurdleuse",
        middle: "aucune demi-fondeuse",
        long: "aucune fondeuse",
        relay: "aucune relayeuse",
        horizontal_jumps: "aucune sauteuse en longueur ou au triple saut",
        vertical_jumps: "aucune sauteuse en hauteur ou à la perche",
        throws: "aucune lanceuse",
        combined: "aucune heptathlonienne",
      },
      M: {
        sprint: "aucun sprinteur",
        hurdles: "aucun hurdleur",
        middle: "aucun demi-fondeur",
        long: "aucun fondeur",
        relay: "aucun relayeur",
        horizontal_jumps: "aucun sauteur en longueur ou au triple saut",
        vertical_jumps: "aucun sauteur en hauteur ou à la perche",
        throws: "aucun lanceur",
        combined: "aucun décathlonien",
      },
    },
    short: (count: number, minimum: number, nobody: string[]) => {
      const athletes = count <= 1 ? "athlète" : "athlètes";
      const missing =
        nobody.length === 0
          ? ""
          : nobody.length === 1
            ? nobody[0]
            : `${nobody.slice(0, -1).join(", ")} ni ${nobody[nobody.length - 1]}`;
      const why = missing ? ` : il ne restait plus ${missing} libre à la fin du mercato` : "";
      return `Ton équipe compte ${count} ${athletes} au lieu de ${minimum}${why}. Tu joues quand même.`;
    },
    cardLabel: (name: string, discipline: string, paid: number) =>
      `${name}, ${discipline}, payé ${paid} crédits`,
    /** A card of a head-to-head (#605): the athlete's points, sporting bonuses included. */
    scoredCardLabel: (name: string, discipline: string, points: number | null, bonus: number) =>
      `${name}, ${discipline}, ${points === null ? "points à venir" : pts(points)}${bonus > 0 ? `, dont ${bonus} de bonus` : ""}`,
    bonus: (n: number) => `+${n}`,
    points: (n: number | null) => (n === null ? "–" : pts(n)),
    absent: "Absent·e",
  },
  lineup: {
    title: "Mon alignement",
    subtitle: "Aligne tes athlètes avant chaque compétition.",
    link: "Mon alignement",
    competitions: "Compétitions éligibles",
    noCompetition: "Aucune compétition éligible dans cette ligue pour l'instant.",
    status: { todo: "À aligner", validated: "Validé", locked: "Verrouillé" },
    places: (filled: number, total: number) => `${filled}/${total} places`,
    stadium: "Le stade",
    place: {
      sprint: "Sprint",
      middle: "Demi-fond",
      long: "Fond",
      jumps: "Sauts",
      throws: "Lancers",
      combined: "Combinées",
      free: "Libre",
    },
    emptyPlace: (place: string) => `Place ${place}, vide`,
    takenPlace: (place: string, name: string) => `Place ${place} : ${name}, changer`,
    lockedPlace: (place: string, name: string) => `Place ${place} : ${name}`,
    unfillablePlace: (place: string) => `Place ${place} : aucun athlète de ton équipe disponible`,
    nobody: "Personne",
    add: "+",
    bench: "Remplaçants",
    benchEmpty: "Tous tes athlètes engagés sont alignés.",
    hint: "Touche une place du stade pour y mettre un athlète de ton équipe.",
    sheetTitle: (place: string) => `Place ${place}`,
    sheetHint: (place: string) =>
      place === "Libre"
        ? "Une place libre accueille un athlète de n'importe quelle famille."
        : `Seuls les athlètes de la famille ${place} vont sur cette place.`,
    choices: "Athlètes de ton équipe",
    onThisPlace: "Sur cette place",
    elsewhere: (place: string) => `Déjà sur la place ${place} : touche pour l'échanger`,
    notEntered: "Absent·e : pas engagé·e dans cette compétition",
    wrongFamily: (place: string) => `Ne va pas sur une place ${place}`,
    remove: "Retirer de cette place",
    noEligible: "Aucun athlète de ton équipe ne peut aller sur cette place.",
    validating: "Validation en cours…",
    toFill: (places: { label: string; count: number }[]) =>
      `À remplir : ${places.map((p) => (p.count > 1 ? `${p.label} ×${p.count}` : p.label)).join(", ")}`,
    full: "Toutes les places sont remplies.",
    validate: "Valider mon alignement",
    validated: "Alignement validé, modifiable jusqu'au verrouillage.",
    locked: "Verrouillé : la compétition a commencé.",
    notOver: "Le mercato n'est pas fini : tu aligneras ton équipe une fois qu'il sera clos.",
    noTeam: "Ton équipe n'a aucun athlète : rien à aligner.",
  },
  managerPoints: {
    title: "Mes points",
    link: "Mes points",
    summary: "Mon score de la compétition",
    total: "Total de la compétition",
    points: pts,
    hungarian: "Barème hongrois",
    bonus: "Bonus sportifs",
    predictions: "Mes pronos",
    starters: "Mes titulaires",
    athletePoints: pts,
    performance: (a: { discipline: string | null; mark: string | null; status: string | null }) =>
      a.status === null
        ? "Pas de performance saisie"
        : a.status === "ok"
          ? `${a.discipline} · ${a.mark}`
          : `${a.discipline} · ${{ dns: "Non-partant", dnf: "Abandon", dq: "Disqualifié·e" }[a.status] ?? a.status}`,
    bonusTag: (
      bonus:
        | "first"
        | "second"
        | "third"
        | "personal_best"
        | "season_best"
        | "national_record"
        | "area_record"
        | "world_record",
      points: number,
    ) =>
      `${
        {
          first: "1re",
          second: "2e",
          third: "3e",
          personal_best: "Record perso",
          season_best: "Meilleure perf. de la saison",
          national_record: "Record national",
          area_record: "Record continental",
          world_record: "Record du monde",
        }[bonus]
      } +${points}`,
    help: "La performance donne les points, quelle que soit la place ; les bonus s'ajoutent.",
    notYet: "Les points de cette compétition ne sont pas encore calculés.",
    noLineup: "Pas d'alignement validé avant le verrouillage : 0 point pour cette compétition.",
    lineupLink: "Mon alignement",
  },
  managerChampionship: {
    matchdayLink: "La journée",
    standingsLink: "Classement",
    matchdays: "Journées du championnat",
    matchdayTab: (round: number) => `J${round}`,
    matchdayTabLabel: (round: number) => `Journée ${round}`,
    matchdayTitle: (round: number) => `Journée ${round}`,
    noCompetition: "Sans compétition",
    leg: { first: "Aller", return: "Retour" } as Record<"first" | "return", string>,
    duelCount: (n: number) => `${n} ${n <= 1 ? "confrontation" : "confrontations"}`,
    state: {
      played: "Terminée",
      upcoming: "À venir",
      bonus: "Journée bonus",
      not_played: "Non jouée",
    } as Record<"played" | "upcoming" | "bonus" | "not_played", string>,
    duels: "Confrontations",
    vs: "contre",
    duelLabel: (home: string, away: string) => `${home} contre ${away}`,
    myDuel: "Ma confrontation",
    score: (n: number | null) => (n === null ? "–" : `${n}`),
    result: (result: "home" | "away" | "draw" | null) =>
      result === null
        ? "Résultat après le calcul des points Manager"
        : result === "draw"
          ? "Match nul · +1 chacun"
          : result === "home"
            ? "Victoire à domicile · +3"
            : "Victoire à l'extérieur · +3",
    bonusText:
      "Journée bonus : chacun marque ses points Manager, sans confrontation ni points au classement.",
    notPlayedText: "Plus de compétition pour cette journée : elle ne se joue pas.",
    standingsTitle: "Classement",
    standingsCaption: "Classement du championnat",
    columns: {
      rank: "Rang",
      player: "Joueur",
      wins: "V",
      draws: "N",
      losses: "D",
      difference: "Diff.",
      points: "Pts",
    },
    columnLabels: {
      wins: "Victoires",
      draws: "Matchs nuls",
      losses: "Défaites",
      difference: "Différence de points Manager",
      points: "Points au championnat",
    },
    difference: (n: number) => (n > 0 ? `+${n}` : `${n}`),
    me: "toi",
    tieRule:
      "Victoire 3 points, nul 1, défaite 0. À égalité : nombre de victoires, puis différence de points Manager (marqués moins encaissés), puis points Manager marqués. Les journées bonus ne comptent pas.",
    notStarted: "Le calendrier sera tiré à la clôture du mercato : tout le monde part de zéro.",
    nextTitle: (round: number) => `Journée ${round} · le choc`,
    nextAgainst: (home: boolean) => (home ? "À domicile contre" : "À l'extérieur contre"),
    noNext: "Plus de confrontation à jouer cette saison.",
    calendarLink: "Voir le calendrier",
    ended: "Saison terminée : le classement est figé.",
    endLink: "Voir la fin de saison",
  },
  managerHome: {
    mySeason: "Ma saison",
    notStarted: "Le calendrier sera tiré à la clôture du mercato.",
    place: "Place",
    rank: (rank: number) => ordinal(rank),
    points: "Points",
    record: (wins: number, draws: number, losses: number) => `${wins} V · ${draws} N · ${losses} D`,
    difference: "Différence",
    nextTitle: (round: number) => `Prochaine confrontation · journée ${round}`,
    nextDuel: (me: string, opponent: string) => `${me} contre ${opponent}`,
    vs: "contre",
    /** The action of the moment, by step of the season. */
    action: {
      league: "Voir ma ligue",
      mercato: "Aller au mercato",
      team: "Voir mon équipe",
      lineup: "Aligner mon équipe",
      points: "Voir la journée",
      duels: "Voir les résultats",
      champion: "Voir la fin de saison",
    } as Record<"league" | "mercato" | "team" | "lineup" | "points" | "duels" | "champion", string>,
    lineupAction: (duration: string) => `Aligner mon équipe · verrouillage dans ${duration}`,
    lastPoints: "Mes derniers points",
    stepsTitle: "Le déroulé de la saison",
    steps: {
      league: { title: "Ligue", text: "Crée ta ligue ou rejoins celle de tes amis." },
      mercato: { title: "Mercato", text: "Recrute tes athlètes aux enchères secrètes." },
      team: { title: "Équipe", text: "Ton équipe est fixée pour toute la saison." },
      lineup: { title: "Alignement", text: "Aligne tes athlètes avant chaque compétition." },
      points: { title: "Points", text: "Tes athlètes marquent des points Manager." },
      duels: { title: "Confrontations", text: "Le plus haut score gagne la journée." },
      champion: { title: "Champion", text: "Le premier du classement est sacré." },
    } as Record<
      "league" | "mercato" | "team" | "lineup" | "points" | "duels" | "champion",
      { title: string; text: string }
    >,
    stepState: { done: "fait", current: "en cours", todo: "à venir" } as Record<
      "done" | "current" | "todo",
      string
    >,
    startTitle: "Créer ou rejoindre une ligue",
    startText:
      "Recrute tes athlètes aux enchères, aligne-les et affronte tes amis toute la saison.",
  },
  /** A card of « Mes ligues Manager » (#774). */
  managerLeagueCard: {
    phase: {
      waiting: "En attente des joueurs",
      mercato: (round: number) => `Mercato · tour ${round}`,
      season: (current: number, total: number) => `Saison · journée ${current} sur ${total}`,
      over: "Saison terminée",
    },
    place: (rank: number) => (rank === 1 ? "1re place" : `${rank}e place`),
    roundEnds: (duration: string) => `Fin du tour dans ${duration}`,
    lineupLocks: (duration: string) => `Verrou d'alignement dans ${duration}`,
    cue: { mercato: "Enchères à faire", lineup: "Alignement à valider" } as Record<
      "mercato" | "lineup",
      string
    >,
  },
  managerDuel: {
    title: "Confrontation",
    subtitle: (round: number) => `Journée ${round}`,
    open: "Voir la confrontation",
    openLabel: (home: string, away: string) => `Voir la confrontation ${home} contre ${away}`,
    summary: "Résultat de la confrontation",
    leg: { first: "Aller", return: "Retour" } as Record<"first" | "return", string>,
    venue: (home: boolean) => (home ? "Domicile" : "Extérieur"),
    outcome: (outcome: "win" | "draw" | "loss", points: number) =>
      `${{ win: "Victoire", draw: "Match nul", loss: "Défaite" }[outcome]} +${points}`,
    you: "toi",
    opponent: "adversaire",
    predictions: (bottom: string, bottomPoints: number, top: string, topPoints: number) =>
      `Pronos : ${bottom} +${bottomPoints}, ${top} +${topPoints} (inclus)`,
    secret:
      "Les alignements restent secrets jusqu'au verrouillage de la compétition : reviens au premier départ.",
    stadium: "Le stade de la confrontation",
    sideOf: (pseudo: string) => `Alignement de ${pseudo}`,
    noLineup: (pseudo: string) => `${pseudo} n'a pas validé d'alignement : 0 point.`,
  },
  managerSeasonEnd: {
    title: "Fin de saison",
    notOver:
      "La saison continue : elle se termine après la dernière journée du calendrier, journées bonus comprises. Le champion et le palmarès viendront alors.",
    champion: "Tu es champion",
    place: (rank: number, players: number) => `Tu finis ${ordinal(rank)} sur ${players}`,
    championOf: (pseudo: string) => `Champion : ${pseudo}`,
    season: (league: string, year: number) => `${league} · saison ${year}`,
    summary: (champion: boolean, wins: number, played: number) =>
      champion
        ? `${wins} ${wins <= 1 ? "victoire" : "victoires"} en ${played} ${played <= 1 ? "confrontation" : "confrontations"} : le titre est pour toi.`
        : `${wins} ${wins <= 1 ? "victoire" : "victoires"} en ${played} ${played <= 1 ? "confrontation" : "confrontations"}. La prochaine saison sera la bonne.`,
    standingsTitle: "Classement final",
    standingsCaption: "Classement final du championnat",
    championBadge: "Champion",
    mySeason: "Ma saison",
    managerPoints: "Points Manager marqués",
    record: "V · N · D",
    recordValue: (wins: number, draws: number, losses: number) => `${wins} · ${draws} · ${losses}`,
    bestAthlete: "Meilleur athlète",
    bestAthleteValue: (name: string, points: number) => `${name} · ${pts(points)}`,
    noBestAthlete: "Aucun athlète aligné",
    rival: (pseudo: string) => `Face à ${pseudo}`,
    rivalValue: (wins: number, draws: number, losses: number) =>
      `${wins} V · ${draws} N · ${losses} D`,
    nextSeason:
      "Nouvelle saison = nouvelle ligue et nouveau mercato. Ton palmarès reste dans ton profil.",
    honoursTitle: "Palmarès Manager",
    honourPlace: (champion: boolean, rank: number, players: number) =>
      champion ? "🏆 Champion" : `${ordinal(rank)} sur ${players}`,
  },
  /** The competition picker of a league, Manager or predictions (#663). */
  seasonPicker: {
    quickTitle: "Sélections rapides",
    quick: {
      season: "Toute la saison",
      indoor: "Saison en salle",
      majors: "Grands championnats",
    },
    /** A quick selection and its count: « Diamond League · 15 ». */
    quickLabel: (label: string, count: number) => `${label} · ${count}`,
    /** A level: the known ones, else read from its slug (« continental-tour-gold »). */
    level: (level: string) =>
      ({ championnat: "Championnats", jo: "Jeux olympiques" })[level] ??
      level
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    searchLabel: "Rechercher une compétition",
    searchPlaceholder: "Nom ou ville",
    scopeLabel: "Portée",
    scope: { all: "Toutes", international: "Internationales", france: "France" },
    venueLabel: "Lieu",
    venue: { all: "Tous", indoor: "Salle", outdoor: "Plein air" },
    levelLabel: "Niveau",
    levelAll: "Tous les niveaux",
    onlyChosen: "Voir seulement mes compétitions cochées",
    checkShown: "Tout cocher",
    uncheckShown: "Tout décocher",
    /** « 12 affichées sur 34 ». */
    shown: (shown: number, total: number) =>
      `${shown} ${shown <= 1 ? "affichée" : "affichées"} sur ${total}`,
    /** « juin 2027 ». */
    month: (month: string) =>
      new Date(`${month}-15T12:00:00Z`).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
        timeZone: "Europe/Paris",
      }),
    /** « 3 / 5 » beside a month: ticked out of shown. */
    monthCount: (ticked: number, total: number) => `${ticked} / ${total}`,
    monthToggle: (month: string, ticked: number, total: number) =>
      `${month}, ${ticked} ${ticked <= 1 ? "cochée" : "cochées"} sur ${total}`,
    noMatch: "Aucune compétition ne correspond à ces filtres.",
    resetFilters: "Réinitialiser les filtres",
    indoorChip: "Salle",
    franceChip: "France",
    /** A row: « Meeting de Paris · sam. 5 juin ». */
    option: (name: string, when: string) => `${name} · ${when}`,
    /** A day in Paris time: « sam. 5 juin ». */
    day: (iso: string) =>
      new Date(iso).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Paris",
      }),
    /** The sticky bar: « 15 compétitions cochées ». */
    chosen: (n: number) => `${n} ${n <= 1 ? "compétition cochée" : "compétitions cochées"}`,
    atLeast: (n: number) => `Il en faut au moins ${n}.`,
    loading: "Chargement des compétitions…",
  },
  leagues: {
    title: "Mes ligues",
    back: "Mes ligues",
    players: (n: number) => `${n} ${n <= 1 ? "joueur" : "joueurs"}`,
    createdByMe: "créée par toi",
    createdBy: (pseudo: string) => `créée par ${pseudo}`,
    noCompetitionTag: "Sans compétition",
    rank: (rank: number) => ordinal(rank),
    rankLabel: (rank: number) => `Ta place : ${ordinal(rank)}`,
    noPointsYet: "Pas encore de points",
    emptyTitle: "Joue entre amis",
    emptyText: "Crée une ligue et partage son code, ou rejoins celle d'un ami.",
    create: "Créer une ligue",
    join: "Rejoindre avec un code",
    haveCode: "J'ai un code",
    myLeagues: "Mes ligues",
    aloneTitle: "Tu es seul pour l'instant",
    aloneText: "Une ligue se joue entre amis : envoie-leur le lien, ils arrivent directement ici.",
    inviteFriends: "Inviter mes amis",
    orGiveCode: (code: string) => `Ou donne le code ${code}`,
    linkCopied: "✓ Lien copié : colle-le à tes amis",
    invite: "Inviter",
    tieHelp: "Comment sont départagées les égalités ?",
    createTitle: "Créer une ligue",
    listSubtitle: "Une ligue compte une ou plusieurs compétitions.",
    createSubtitle:
      "Au moins une compétition maintenant, d'autres plus tard : leurs points s'additionnent.",
    createNone:
      "Aucune compétition à venir ou en cours pour l'instant : reviens quand le calendrier sera annoncé.",
    competitionsTitle: "Compétitions de la ligue",
    noCompetition: "Pas encore de compétition : le classement démarre dès que tu en ajoutes une.",
    noCompetitionMember: "Pas encore de compétition : le créateur de la ligue en ajoutera.",
    noComingCompetition:
      "Aucune compétition à venir pour l'instant : tu pourras l'ajouter dès qu'elle sera annoncée.",
    addLabel: "Ajouter une compétition à venir ou en cours",
    addSubmit: "Ajouter",
    adding: "Ajout…",
    added: "✓ Compétition ajoutée au classement de la ligue.",
    nothingToAdd: "Toutes les compétitions à venir ou en cours sont déjà dans la ligue.",
    publicLabel: "Ligue publique",
    publicHint:
      "Tout le monde peut la trouver et la rejoindre sans code, jusqu'à 200 joueurs. Son nom doit rester correct.",
    publicBadge: "Publique",
    privateBadge: "Privée",
    /** The summed-up league card and « Découvrir » (#662). */
    competitionCount: (n: number) => `${n} ${n <= 1 ? "compétition" : "compétitions"}`,
    period: (start: string, end: string) => {
      const month = (ym: string, year: boolean) =>
        new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("fr-FR", {
          month: "short",
          ...(year ? { year: "numeric" } : {}),
          timeZone: "UTC",
        });
      if (start === end) return month(end, true);
      return `${month(start, start.slice(0, 4) !== end.slice(0, 4))} → ${month(end, true)}`;
    },
    outOf: (n: number) => `sur ${n}`,
    nextCompetition: (name: string, startsOn: string) =>
      `Prochaine : ${name}, ${new Date(`${startsOn}T12:00:00Z`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })}`,
    listTabs: { mine: (n: number) => `Mes ligues · ${n}`, discover: "Découvrir" },
    listTabsLabel: "Mes ligues ou découvrir",
    searchLabel: "Chercher une ligue publique",
    searchPlaceholder: "Nom de la ligue",
    familyFilterLabel: "Famille d'épreuves",
    allFamilies: "Toutes",
    sortLabel: "Trier par",
    sorts: { places: "Places restantes", players: "Plus de joueurs", recent: "Plus récentes" },
    noMatch: "Aucune ligue publique ne correspond. Essaie un autre nom ou une autre famille.",
    fillLabel: (n: number, max: number) => `${n} places prises sur ${max}`,
    loadingLeagues: "Chargement des ligues…",
    publicTitle: "Autres ligues publiques",
    /** When no public league is left to join, from the player's own public leagues (#496). */
    publicNotice: {
      empty: "Pas encore de ligue publique à rejoindre. Crée la première !",
      no_other: "Pas d'autre ligue publique à rejoindre pour l'instant.",
      only_mine: "Tu possèdes déjà la seule ligue publique.",
    },
    publicJoin: "Rejoindre",
    publicJoinLabel: (name: string) => `Rejoindre la ligue publique ${name}`,
    publicJoining: "…",
    publicPlaces: (n: number, max: number) => `${n}/${max} joueurs`,
    officialBadge: "Officielle",
    officialOpen: "Ouverte à tous",
    officialPitch: "Mesure-toi à toute la communauté FrenchTrack",
    officialJoin: (name: string) => `Rejoindre la ${name}`,
    report: "Signaler",
    reportLabel: (name: string) => `Signaler la ligue ${name} à l'admin`,
    reporting: "…",
    reported: "✓ Signalée à l'admin. Merci !",
    how: "Le classement de la ligue additionne les points de ses compétitions, sur les épreuves qui se verrouillent après leur entrée dans la ligue. Tu inviteras tes amis avec un code juste après.",
    nameLabel: "Nom de la ligue",
    nameHint: "2 à 40 caractères. Emoji bienvenus.",
    createSubmit: "Créer la ligue",
    creating: "Création…",
    joinTitle: "Rejoindre",
    joinSubtitle: "Avec le code donné par un ami",
    codeLabel: "Code d'invitation",
    codeHint: "6 caractères, majuscules ou minuscules.",
    joinSubmit: "Rejoindre la ligue",
    joining: "Connexion à la ligue…",
    created: "✓ Ta ligue est prête. Invite tes amis :",
    codeCaption: "Code d'invitation",
    codeNote: "Sans 0, O, 1, I ni L : facile à dicter",
    share: "Partager le lien",
    copy: "Copier le code",
    copied: "✓ Copié",
    shareText: (name: string) => `Rejoins ma ligue « ${name} » sur French Track Prono`,
    linkNote: "Le lien ouvre la ligue directement après connexion.",
    tabs: { ranking: "Classement", members: "Membres" },
    owner: "Créateur",
    tieRule: "Égalité : podiums parfaits, puis vainqueurs trouvés. Toujours égaux : même place.",
    handOver: "Confier la ligue à un membre",
    handOverTitle: "Confier la ligue",
    handOverSubtitle: "Choisis le nouveau créateur",
    handOverSubmit: "Confier la ligue",
    handingOver: "Transmission…",
    handOverNote: "Ensuite, tu pourras quitter la ligue.",
    handOverNobody:
      "Personne d'autre n'est dans la ligue : tu peux la quitter, elle sera supprimée.",
    leave: "Quitter la ligue",
    leaving: "Départ…",
    actions: "Gérer la ligue",
    inviteTitle: "Rejoindre une ligue",
    inviteSubtitle: "Lien d'invitation",
    invited: (code: string) => `Tu as été invité dans une ligue avec le code ${code}.`,
    inviteNote: "Tu rejoins la ligue en un appui ; tu pourras la quitter quand tu veux.",
    /** Leagues limited to event families (#613). */
    family: {
      sprint: "Sprint",
      hurdles: "Haies",
      middle: "Demi-fond",
      long: "Fond",
      jumps: "Sauts",
      throws: "Lancers",
      combined: "Épreuves combinées",
      relay: "Relais",
    },
    familiesTitle: "Épreuves qui comptent",
    allEvents: "Toutes les épreuves",
    allEventsHint: "Toutes les épreuves des compétitions de la ligue comptent.",
    someFamilies: "Certaines familles",
    someFamiliesHint: "Pour les spécialistes et les clubs : seules ces familles comptent.",
    familiesSummary: (names: string[]) => `Comptent dans la ligue : ${names.join(", ")}`,
    familiesNone: "Choisis au moins une famille pour créer la ligue.",
    familiesNote:
      "Tu pourras ajouter une famille plus tard, jamais en retirer. Les pronos restent les mêmes partout.",
    familiesBadge: (names: string[]) => names.join(" · "),
    familiesBadgeLabel: (names: string[]) => `Épreuves qui comptent : ${names.join(", ")}`,
    eventsTitle: "Épreuves de la ligue",
    eventsEmpty: "Pas encore d'épreuve annoncée dans les compétitions de la ligue.",
    outOfLeague: "Hors ligue",
    outOfLeagueNote:
      "Hors ligue : tu peux toujours les pronostiquer, mais elles ne comptent pas dans cette ligue.",
    eventDay: (iso: string) =>
      new Date(iso).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Paris",
      }),
    addFamily: "+ Ajouter une famille",
    addFamilyTitle: "Ajouter une famille",
    addFamilySubtitle: "Les familles déjà choisies restent : aucune ne se retire.",
    lockedFamily: (name: string) => `${name}, déjà dans la ligue`,
    chooseFamily: "Famille à ajouter",
    previewTitle: (name: string) => `${name} dans la ligue`,
    previewCounts: "Compte",
    previewNotCounted: "Ne compte pas",
    previewNote:
      "Seules les épreuves pas encore commencées compteront. Une épreuve commencée ou terminée ne donne aucun point dans la ligue.",
    previewEmpty:
      "Aucune épreuve de cette famille dans les compétitions de la ligue pour l'instant.",
    addFamilySubmit: (name: string) => `Ajouter ${name}`,
    addingFamily: "Ajout…",
    noFamilyToAdd: "Toutes les familles comptent déjà dans cette ligue.",
    /** Shown to every member after the creator added a family. */
    familyAdded: (name: string, iso: string) =>
      `${name} compte dans la ligue depuis le ${new Date(iso).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      })} : seules ses épreuves suivantes rapportent des points.`,
  },
  ranking: {
    title: "Classement",
    subtitle: "Tous les joueurs · toutes les compétitions",
    competitionSubtitle: (name: string) => `Tous les joueurs · ${name}`,
    tonightSubtitle: "Points gagnés sur les finales de ce soir · tous les joueurs",
    leagueSubtitle: (name: string) => `Ta ligue · ${name}`,
    noLeagueSubtitle: "Joue contre tes amis",
    viewLabel: "Vue du classement",
    view: { ligue: "Ma ligue", soir: "Ce soir", general: "Général" },
    scope: {
      league: "Ligue",
      general: "Portée",
      change: "Changer",
      changeLabel: (name: string) => `Changer de classement (${name} affiché)`,
      players: (n: number) => `${n} ${n <= 1 ? "joueur" : "joueurs"}`,
      season: (years: { from: number; to: number } | null) =>
        !years
          ? "Toute la saison"
          : years.from === years.to
            ? `Toute la saison ${years.from}`
            : `Toute la saison ${years.from}-${String(years.to).slice(-2)}`,
      tonight: (competition: string | null, day: string) => {
        const date = new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        });
        return competition
          ? `Points des finales de ce soir · ${competition}, ${date}`
          : `Points des finales de ce soir · ${date}`;
      },
      loading: "Chargement de la portée…",
      error: "Les classements à choisir ne sont pas disponibles pour le moment.",
    },
    sheet: {
      title: "Choisir le classement",
      tabsLabel: "Type de classement",
      tabs: { competitions: "Saison ou compétition", leagues: "Mes ligues" },
      live: "En cours",
      past: "Terminées",
      none: "Aucune compétition ne correspond.",
      allSeason: "Tous les joueurs · toutes les compétitions",
      leagueRank: (rank: number | null, members: number) =>
        rank
          ? `${ordinal(rank)} sur ${members}`
          : `Pas encore classé · ${members} ${members <= 1 ? "joueur" : "joueurs"}`,
      competitions: (n: number) => `${n} ${n <= 1 ? "compétition" : "compétitions"}`,
      noLeague: "Tu n'as pas encore de ligue : joue contre tes amis.",
      createOrJoin: "Créer ou rejoindre une ligue",
    },
    place: {
      title: "Ta place",
      rank: (rank: number) => ordinal(rank),
      points: pts,
      since: "depuis la dernière compétition",
      ahead: (gap: number, pseudo: string, rank: number) =>
        gap === 0
          ? `À égalité de points avec ${pseudo} (${ordinal(rank)})`
          : `${pts(gap)} derrière ${pseudo} (${ordinal(rank)})`,
      first: "Personne devant toi",
      top: (percent: number) => `Top ${percent} %`,
      loading: "Chargement de ta place…",
      error: "Ta place n'est pas disponible pour le moment.",
    },
    you: (rank: number, points: number) => `Tu es ${ordinal(rank)} · ${pts(points)}`,
    aroundMe: "Autour de moi",
    notRanked: "Tu n'as pas encore de points : fais tes pronos pour entrer au classement.",
    tonightEmpty:
      "Pas encore de points ce soir : ils arrivent dès que les résultats des finales du jour sont saisis.",
    notRankedTonight: "Pas de points pour toi ce soir.",
    predict: "Faire mes pronos",
    visitor: "Connecte-toi pour poser tes podiums et entrer au classement.",
    starts: (startsOn: string, days: number) => {
      const day = new Date(`${startsOn}T12:00:00Z`).toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
      return `Le classement démarre · ${day} · ${days === 1 ? "Demain" : `Dans ${days} jours`}`;
    },
    firstPodiums: "Poser mes premiers podiums",
  },
  admin: {
    band: "Back-office",
    signOut: "Se déconnecter",
    viewSite: "Voir le site",
    statsLabel: "État de la compétition",
    stats: {
      open: "Ouvertes aux pronos",
      todo: "Résultat à saisir",
      entered: "Points à calculer",
      scored: "Points calculés",
    },
    title: "Résultats",
    subtitle: (competition: string, count: number) =>
      `${competition} · ${count} ${count <= 1 ? "épreuve verrouillée" : "épreuves verrouillées"}`,
    filters: "Filtrer par état",
    filter: {
      open: (n: number) => `Ouvertes (${n})`,
      todo: (n: number) => `À saisir (${n})`,
      entered: (n: number) => `Saisis (${n})`,
      scored: (n: number) => `Calculés (${n})`,
    },
    state: {
      open: "Liste de départ",
      todo: "Sans résultat",
      entered: "Résultat saisi",
      scored: "Points calculés",
    },
    empty: "Aucune épreuve dans cet état.",
    lockedOnly: "Seules les épreuves verrouillées peuvent recevoir un résultat.",
    noSheet:
      "Aucun résultat pour l'instant : une seule feuille par épreuve donne le podium des pronos et les points du Manager.",
    enterSheet: "Saisir la feuille de résultats",
    resultSaved: "✓ Feuille de résultats enregistrée.",
    recompute: "Recalculer",
    computing: "Calcul…",
    correct: "Corriger la feuille de résultats",
    computeNote:
      "Chaque feuille enregistrée calcule les points des pronos puis ceux du Manager. « Recalculer » relance le même calcul en secours : les points sont remplacés, jamais ajoutés deux fois.",
    computed: (players: number) =>
      `✓ Points calculés pour ${players} ${players <= 1 ? "joueur" : "joueurs"}.`,
    kpi: {
      predictions: "joueurs",
      total: "points donnés",
      atZero: "à 0 point",
      averageAndBest: (average: string, best: number) =>
        `Moyenne ${average} pts · meilleur score ${pts(best)}`,
    },
    missingRanks: (ranks: number[]) =>
      `Podium incomplet : il manque ${ranks.map((r) => (r === 1 ? "la 1re place" : `la ${r}e place`)).join(" et ")}. Corrige la feuille de résultats.`,
    detail: "Détail",
    noPrediction: "Personne n'a pronostiqué cette épreuve.",
  },
  startList: {
    title: "Liste de départ",
    back: "Épreuve",
    link: (n: number) => `Liste de départ (${n})`,
    chosen: "Au départ",
    count: (n: number, max: number) => `${n} / ${max}`,
    empty: "Personne au départ pour l'instant : cherche un athlète ci-dessous.",
    seasonBest: (name: string) => `Meilleure marque de la saison de ${name}`,
    seasonBestPlaceholder: "MPS",
    remove: (name: string) => `Retirer ${name}`,
    add: "Ajouter un athlète",
    search: "Rechercher un athlète",
    matches: "Athlètes trouvés",
    noMatch: "Aucun athlète ne correspond.",
    ofDiscipline: (discipline: string, n: number) =>
      `${n <= 1 ? "Athlète" : "Athlètes"} du ${discipline} (${n})`,
    noneOfDiscipline: (discipline: string) =>
      `Aucun athlète de cette catégorie n'a le ${discipline} dans ses disciplines : ajoute-la dans sa fiche athlète.`,
    toAthletes: "Ouvrir les athlètes",
    addOne: "Ajouter",
    alreadyIn: "✓ Au départ",
    duplicate: (name: string) => `${name} est déjà au départ.`,
    full: "La liste de départ est complète (24 athlètes).",
    save: "Enregistrer la liste de départ",
    saving: "Enregistrement…",
    saved: (n: number) =>
      `✓ Liste de départ enregistrée : ${n} ${n <= 1 ? "athlète" : "athlètes"}.`,
  },
  performances: {
    title: "Feuille de résultats",
    back: "Épreuve",
    link: "Feuille de résultats",
    intro:
      "Une seule saisie par épreuve : les places 1 à 3 font le podium officiel des pronos, les marques et les records comptent pour French Track Manager. À l'enregistrement, les points des pronos et du Manager sont calculés. Une nouvelle saisie remplace la précédente.",
    empty: "Personne au départ : saisis d'abord la liste de départ.",
    podiumOnly: "Aucune équipe Manager sur cette compétition : le podium suffit.",
    missing: (missing: number, linedUp: number) =>
      linedUp === 0
        ? "Aucun athlète de cette épreuve n'est aligné dans une ligue Manager."
        : missing === 0
          ? linedUp === 1
            ? "✓ L'athlète aligné a une performance."
            : `✓ Les ${linedUp} athlètes alignés ont une performance.`
          : `${missing} ${missing <= 1 ? "athlète aligné sans performance" : "athlètes alignés sans performance"} (sur ${linedUp}) : sans performance, un aligné compte 0.`,
    linedUp: "Aligné",
    linedUpMissing: "Aligné · à saisir",
    status: "Statut",
    statusName: {
      none: "Non saisi",
      ok: "Arrivé",
      dns: "Non partant (DNS)",
      dnf: "Abandon (DNF)",
      dq: "Disqualifié (DQ)",
    },
    place: "Place",
    mark: "Marque",
    records: (name: string) => `Records de ${name}`,
    recordShort: { pb: "RP", sb: "MPS", nr: "RN", ar: "RC", wr: "RM" },
    recordName: {
      pb: "Record personnel",
      sb: "Meilleure performance de la saison",
      nr: "Record national",
      ar: "Record continental",
      wr: "Record du monde",
    },
    save: "Enregistrer et calculer les points",
    saving: "Enregistrement et calcul…",
    confirmOutOfRange: "J'ai vérifié : enregistrer ces marques quand même",
    outOfRange: "Hors des valeurs habituelles",
    paste: {
      title: "Coller les résultats",
      hint: "Copie le tableau de la page de résultats World Athletics et colle-le ici : la feuille se pré-remplit. Vérifie-la, rien n'est enregistré avant « Enregistrer ».",
      label: "Tableau de résultats",
      apply: "Pré-remplir la feuille",
      none: "Aucune ligne de résultat trouvée dans le texte collé.",
      matched: (n: number) => (n <= 1 ? `${n} athlète pré-rempli.` : `${n} athlètes pré-remplis.`),
      unmatched: (n: number) =>
        n <= 1 ? `${n} ligne non reconnue :` : `${n} lignes non reconnues :`,
    },
  },
  install: {
    title: "Installe l'appli",
    body: "Tes pronos en un geste, sur ton écran d'accueil.",
    install: "Installer",
    dismiss: "Fermer, ne plus proposer",
    // Non-breaking spaces keep the guillemets on the line of their words.
    ios: {
      before: "Touche",
      share: "Partager",
      after: ", puis « Sur l'écran d'accueil ».",
    },
    inApp:
      "Touche ⋯ en haut de l'écran, puis « Ouvrir dans le navigateur », pour l'ajouter à ton écran d'accueil.",
    profile: "Installer l'appli",
  },
  adminLog: {
    title: "Historique",
    subtitle: "Les 50 dernières actions du back-office.",
    filters: "Filtrer l'historique",
    admin: "Admin",
    event: "Épreuve",
    since: "Depuis le",
    allAdmins: "Tous",
    allEvents: "Toutes",
    apply: "Filtrer",
    clear: "Effacer",
    empty: "Aucune action pour ces filtres.",
    lines: "Actions",
    kind: {
      set_start_list: "Liste de départ",
      set_results: "Résultat saisi",
      run_scoring: "Points calculés",
      set_tolerance: "Tolérance modifiée",
      edit_athlete: "Athlète modifié",
      edit_competition: "Compétition modifiée",
      set_odds: "Cotes enregistrées",
      set_rule: "Barème modifié",
      moderate_league: "Ligue modérée",
      moderate_player: "Joueur modéré",
      create_discipline: "Discipline créée",
      moderate_club: "Club modifié",
      set_manager_rules: "Règles Manager modifiées",
      set_performances: "Feuille de résultats saisie",
      run_manager_scoring: "Points Manager calculés",
    },
    noEvent: "Épreuve supprimée",
    size: (
      kind:
        | "set_start_list"
        | "set_results"
        | "run_scoring"
        | "set_tolerance"
        | "edit_athlete"
        | "edit_competition"
        | "set_odds"
        | "set_rule"
        | "moderate_league"
        | "moderate_player"
        | "create_discipline"
        | "moderate_club"
        | "set_manager_rules"
        | "set_performances"
        | "run_manager_scoring",
      n: number,
    ) =>
      kind === "set_rule" || kind === "set_manager_rules"
        ? "barème"
        : kind === "moderate_league"
          ? "ligue publique"
          : kind === "moderate_player"
            ? "compte joueur"
            : kind === "create_discipline"
              ? "discipline"
              : kind === "moderate_club"
                ? "club"
                : kind === "set_tolerance"
                  ? "barème"
                  : kind === "edit_athlete"
                    ? "fiche athlète"
                    : kind === "edit_competition"
                      ? "compétition"
                      : kind === "set_odds"
                        ? `${n} cotes`
                        : kind === "run_scoring" || kind === "run_manager_scoring"
                          ? `${n} ${n <= 1 ? "joueur" : "joueurs"}`
                          : kind === "set_results"
                            ? `${n} ${n <= 1 ? "ligne" : "lignes"}`
                            : `${n} ${n <= 1 ? "athlète" : "athlètes"}`,
    by: (pseudo: string | null) => (pseudo ? `par ${pseudo}` : "par un compte supprimé"),
  },
  import: {
    title: "Importer une liste",
    link: "Importer une liste (CSV)",
    paste: "Colle la liste de départ",
    placeholder: "Nom;Pays;SB\nRICHARDSON Sha'Carri;USA;10.71",
    hint: "Une ligne par athlète. Virgules, points-virgules ou tabulations ; colonnes nom, pays et SB dans n'importe quel ordre (SB facultatif).",
    analyse: "Analyser",
    errors: {
      CSV_EMPTY: "Rien à importer : colle au moins une ligne.",
      CSV_NO_NAME: "Aucune colonne de noms trouvée. Ajoute une ligne d'en-tête « Nom ».",
    },
    summary: (matched: number, ambiguous: number, created: number) =>
      `${matched} ${matched <= 1 ? "reconnu" : "reconnus"} · ${ambiguous} à confirmer · ${created} ${created <= 1 ? "nouveau" : "nouveaux"}`,
    report: "Rapport d'import",
    status: { matched: "Reconnu", ambiguous: "À confirmer", new: "Nouveau" },
    choose: "Quel athlète ?",
    skip: "Ne pas importer",
    create: "Créer cet athlète",
    country: "Pays",
    apply: (n: number) => `Appliquer (${n} ${n <= 1 ? "athlète" : "athlètes"})`,
    applying: "Import…",
  },
  offline: {
    title: "Pas de réseau",
    body: "Cette page n'est pas disponible hors ligne. Reviens quand le réseau revient.",
    retry: "Réessayer",
    prediction: "Pas de réseau : ton podium n'est pas enregistré. Réessaie une fois connecté.",
  },
  athlete: {
    subtitle: (country: string, gender: string) => `${country} · ${gender}`,
    records: "Records",
    pr: "PB",
    sb: "SB",
    recordsHint: "PB : record personnel · SB : meilleure perf de la saison",
    noRecord: "Pas encore de record connu.",
    races: "Dernières épreuves",
    noRace: "Pas encore de résultat dans le jeu.",
    rank: (rank: number) => (rank === 1 ? "1re" : `${rank}e`),
    profileOf: (name: string) => `Fiche de ${name}`,
  },
  rounds: {
    previous: (n: number) => `Perfs des tours précédents (${n})`,
    label: (round: "series" | "quarter" | "semi" | "final", n: number) =>
      ({ series: `Série ${n}`, quarter: `Quart ${n}`, semi: `Demi-finale ${n}`, final: "Finale" })[
        round
      ],
    name: { series: "Série", quarter: "Quart de finale", semi: "Demi-finale", final: "Finale" },
    noResult: "Pas encore de résultat.",
    promote: "Qualifier pour le tour suivant",
    promoteTop: "Nombre de qualifiés",
    promoted: "✓ Qualifiés ajoutés à la liste de départ du tour suivant.",
    previousLinks: "Tours précédents",
  },
  rules: {
    title: "Comment jouer",
    intro:
      "Avant chaque finale, compose ton podium. Les points tombent quand le résultat officiel est saisi.",
    link: "Comment jouer ?",
    helpLabel: "Comment jouer : les règles",
    help: "Règles",
    allRules: "Toutes les règles",
    podiumTitle: "Le podium",
    podium: (exact: number, wrong: number, perfect: number) =>
      `Choisis le 1er, le 2e et le 3e. Chaque athlète à la bonne place rapporte ${exact} points, un athlète sur le podium mais à une autre place ${wrong} point${wrong > 1 ? "s" : ""}. Les trois dans l'ordre : ${perfect} points de bonus.`,
    podiumExample: (exact: number, perfect: number) =>
      `Exemple : podium parfait = 3 × ${exact} + ${perfect} = ${3 * exact + perfect} points.`,
    oddsTitle: "Les cotes",
    odds: (a: number, b: number, c: number) =>
      `Sur les compétitions avec cotes, tu choisis parmi les athlètes proposés par l'admin ou « Autre athlète ». En plus du podium, chaque athlète rapporte sa cote × ${a} à la bonne place, × ${b} à une place d'écart, × ${c} à deux places.`,
    oddsExample: (odds: string, a: number, points: number) =>
      `Exemple : une athlète à ${odds} à la bonne place rapporte ${odds} × ${a} = ${points} points en plus.`,
    other:
      "« Autre athlète » est juste quand un athlète qui n'était pas proposé finit à cette place.",
    marksTitle: "Les perfs",
    marks: (exact: number, near: number) =>
      `Tu peux aussi pronostiquer la perf de chacun de tes athlètes : ${exact} points si tu es dans la tolérance de la discipline, ${near} dans le double. C'est facultatif.`,
    tolerancesTitle: "Quelques tolérances",
    jokerTitle: "Le joker",
    joker: (multiplier: number) =>
      `Une fois par compétition, ton joker multiplie par ${multiplier} tous les points d'une épreuve. Choisis-la bien.`,
    flairTitle: "Le coup de flair",
    flair: (bonus: number, share: number, players: number) =>
      `Tu trouves le vainqueur alors que moins de ${Math.round(share * 100)} % des joueurs l'avaient choisi ? +${bonus} points, dès ${players} pronos sur l'épreuve.`,
    lockTitle: "Le verrouillage",
    lock: "Tu peux changer ton prono jusqu'au départ de l'épreuve. Ensuite il est figé, et tu découvres ceux de tes amis.",
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Un athlète de mon podium ne prend pas le départ ?",
        a: "Il ne rapporte rien. Tant que l'épreuve n'est pas verrouillée, tu peux le remplacer.",
      },
      {
        q: "Deux athlètes finissent ex æquo ?",
        a: "Ils partagent la place : les mettre l'un ou l'autre à cette place compte comme juste.",
      },
      {
        q: "J'ai oublié de pronostiquer ?",
        a: "Pas de pénalité : tu ne marques simplement pas de points sur cette épreuve.",
      },
      {
        q: "Que veulent dire PB et SB ?",
        a: "PB : le record personnel de l'athlète dans la discipline. SB : sa meilleure perf de la saison. Ils t'aident à choisir ton podium et tes perfs.",
      },
      {
        q: "Faut-il une ligue pour jouer ?",
        a: "Oui : pour pronostiquer une épreuve, sois dans une ligue qui compte sa compétition (crée-la, rejoins celle d'un ami ou une ligue publique). Tes points comptent aussi au classement général.",
      },
      {
        q: "Je suis dans plusieurs ligues ?",
        a: "Un seul prono par épreuve, compté dans toutes tes ligues et au classement général.",
      },
    ],
  },
  tips: {
    label: "Premier prono : astuces",
    steps: [
      "Touche un athlète : il monte sur la marche en surbrillance, le 1er d'abord.",
      "Touche une marche pour la choisir, ou un athlète placé pour le retirer.",
      "Le joker double tes points sur une épreuve par compétition. Enregistre, tu peux changer jusqu'au départ.",
    ],
    count: (index: number, total: number) => `${index} / ${total}`,
    next: "Suivant",
    done: "C'est parti",
    skip: "Passer",
  },
  scale: {
    title: "Barème",
    subtitle:
      "Les points de chaque pronostic. Un changement compte pour les calculs lancés ensuite, pas pour les points déjà donnés.",
    groups: { podium: "Podium", bonus: "Coup de flair et joker", odds: "Cotes", marks: "Perfs" },
    rules: {
      exact_slot: "Bon athlète à la bonne place",
      wrong_place: "Athlète sur le podium, mauvaise place",
      perfect_podium: "Bonus podium parfait",
      flair_bonus: "Bonus coup de flair",
      flair_threshold: "Coup de flair : part maximale des joueurs (0 à 1)",
      flair_min_players: "Coup de flair : pronos minimum sur l'épreuve",
      joker_multiplier: "Multiplicateur du joker",
      odds_exact: "Cote × … à la bonne place",
      odds_one_off: "Cote × … à une place d'écart",
      odds_two_off: "Cote × … à deux places d'écart",
      mark_exact: "Perf dans la tolérance",
      mark_near: "Perf dans le double de la tolérance",
    } as Record<string, string>,
    save: "Enregistrer",
    saving: "…",
    saved: "Enregistré.",
  },
  managerRules: {
    title: "Règles Manager",
    subtitle:
      "Les règles générales de French Track Manager. Une ligue copie les règles en vigueur à sa création et les garde : un changement ne touche que les ligues créées ensuite.",
    team: "Budget et équipe",
    budget: "Budget de départ (crédits)",
    minTeamSize: "Taille minimum d'une équipe",
    quotas: "Quotas de l'équipe (minimum et maximum par sexe)",
    quotaHint: "Une famille à 0 au maximum ne se recrute pas.",
    family: "Famille",
    sex: { F: "Femmes", M: "Hommes" },
    min: "min",
    max: "max",
    quotaLabel: (sex: string, family: string, bound: string) => `${family}, ${sex}, ${bound}`,
    lineup: "Alignement",
    lineupMax: "Athlètes alignés au plus",
    lineupMin: "Minimum aligné par famille",
    mercato: "Mercato",
    firstHours: "Durée des premiers tours (heures)",
    longRounds: "Nombre de premiers tours",
    nextHours: "Durée des tours suivants (heures)",
    closeModes: "Clôtures autorisées",
    closeMode: {
      budgets_spent: "Plus aucun budget",
      last_bidder: "Choix du dernier enchérisseur",
      scheduled: "Date programmée",
    },
    bonuses: "Bonus sportifs (points)",
    bonus: {
      first: "1re place",
      second: "2e place",
      third: "3e place",
      personal_best: "Record personnel",
      season_best: "Meilleure perf de la saison",
      national_record: "Record national",
      area_record: "Record continental",
      world_record: "Record du monde",
    },
    season: "Saison",
    startsOn: "Début",
    endsOn: "Fin",
    competitions: "Compétitions éligibles",
    noCompetition: "Aucune compétition à venir.",
    save: "Enregistrer les règles",
    saving: "…",
    saved: "Règles enregistrées. Les prochaines ligues les utiliseront.",
  },
  disciplines: {
    title: "Disciplines",
    subtitle:
      "Tolérance du prono de performance : l'écart maximal pour qu'une marque pronostiquée soit juste.",
    family: {
      sprint: "Sprint",
      hurdles: "Haies",
      middle: "Demi-fond",
      long: "Fond",
      relay: "Relais",
      horizontal_jumps: "Sauts horizontaux",
      vertical_jumps: "Sauts verticaux",
      throws: "Lancers",
      combined: "Épreuves combinées",
    },
    unit: { time: "s", distance: "m", points: "pts" },
    direction: { lower: "temps le plus bas", higher: "valeur la plus haute" },
    newDiscipline: "+ Nouvelle discipline",
    nameLabel: "Nom",
    familyLabel: "Famille",
    unitLabel: "Unité",
    unitName: { time: "Temps (s)", distance: "Distance (m)", points: "Points" },
    directionLabel: "Le meilleur",
    toleranceLabel: "Tolérance du prono de performance",
    create: "Créer la discipline",
    creating: "Création…",
    created: (name: string) => `✓ ${name} est créée : elle est proposée pour les épreuves.`,
    tolerance: (name: string) => `Tolérance du ${name}`,
    save: "Enregistrer",
    saving: "…",
    saved: "✓ Enregistré",
  },
  adminAthletes: {
    filterDiscipline: "Par discipline",
    filterGender: "Par sexe",
    filterCountry: "Par pays",
    all: "Tous",
    found: (n: number) => (n <= 1 ? `${n} athlète` : `${n} athlètes`),
    title: "Athlètes",
    saved: "✓ Enregistré.",
    identity: "Identité",
    managerPrice: "Prix French Track Manager",
    managerPriceHint:
      "L'enchère minimale au mercato, en crédits. Vide : l'athlète n'est pas dans le catalogue.",
    managerPriceLabel: "Prix (crédits)",
    name: "Nom",
    gender: "Catégorie",
    disciplines: "Disciplines, PB et SB",
    noDiscipline: "Aucune discipline : ajoute-en une ci-dessous.",
    main: "Principale",
    makeMain: "Principale",
    remove: (discipline: string) => `Retirer ${discipline}`,
    mark: (kind: string, discipline: string) => `${kind} au ${discipline}`,
    date: "Date",
    saveRecords: (discipline: string) => `Enregistrer PB et SB du ${discipline}`,
    addDiscipline: "Ajouter une discipline",
    choose: "Choisir…",
    create: "Nouvel athlète",
    createSubmit: "Créer l'athlète",
    mainDiscipline: "Discipline principale",
    offCatalogueNoMainDiscipline: "Absent du catalogue : discipline principale manquante",
  },
  adminDashboard: {
    title: (pseudo: string) => `Bonjour ${pseudo}`,
    todo: "À faire",
    tiles: {
      results: "Résultats à saisir",
      odds: "Finales sans cotes",
      clubs: "Clubs à valider",
      leagues: "Ligues signalées",
    },
    tileHint: {
      results: (competition: string) => competition,
      odds: "Ouvertes aux pronos",
      clubs: "Saisis par les joueurs",
      leagues: "Par les joueurs",
    },
    unavailable: "—",
    players: "Joueurs",
    weeks: "8 dernières semaines",
    registered: "inscrits",
    active: "actifs cette semaine",
    predicted: "ont fait au moins 1 prono",
    newThisWeek: (n: number) => `Nouveaux inscrits par semaine · cette semaine : ${n}`,
    chart: (counts: string) =>
      `Nouveaux inscrits, de la plus ancienne semaine à cette semaine : ${counts}`,
    next: "Prochaine compétition",
    daysLeft: (n: number) => (n <= 0 ? "En cours" : `J-${n}`),
    finals: (place: string, n: number) =>
      `${place ? `${place} · ` : ""}${n} ${n <= 1 ? "finale" : "finales"}`,
    startLists: "Listes de départ",
    odds: "Cotes saisies",
    of: (done: number, total: number) => `${done} / ${total}`,
    recent: "Dernières actions",
    noAction: "Aucune action pour l'instant.",
    allActions: "Tout l'historique ›",
    newCompetition: "+ Nouvelle compétition",
  },
  adminList: {
    filters: "Filtres",
    selectAll: "Tout sélectionner sur la page",
    select: (label: string) => `Sélectionner ${label}`,
    selected: (count: number) => (count > 1 ? `${count} sélectionnés` : "1 sélectionné"),
    clearSelection: "Désélectionner",
    open: (label: string) => `Ouvrir ${label}`,
    close: "Fermer",
    range: (first: number, last: number, total: number) =>
      total === 0 ? "Aucune ligne" : `${first}–${last} sur ${total}`,
    previous: "Page précédente",
    next: "Page suivante",
    page: (page: number, count: number) => `Page ${page} sur ${count}`,
    undo: "Annuler",
    undone: "Action annulée.",
    cancel: "Annuler",
    loading: "Chargement…",
    empty: "Rien à afficher.",
    noMatch: "Aucun résultat pour cette recherche.",
    failed: "L'action n'a pas abouti. Réessaie.",
  },
  adminCompetitions: {
    edit: "Modifier",
    editTitle: "Modifier la compétition",
    editSubmit: "Enregistrer les modifications",
    deleteTitle: "Supprimer la compétition",
    deleteHint:
      "Possible tant que personne n'a pronostiqué : ses épreuves, engagés et cotes partent avec elle.",
    deleteSubmit: (name: string) => `Supprimer « ${name} »`,
    editEvent: "Modifier l'épreuve",
    editEventSubmit: "Enregistrer l'épreuve",
    editEventHint:
      "L'horaire et le verrouillage se changent à tout moment ; le tour, seulement tant que personne n'a pronostiqué.",
    deleteEvent: "Supprimer l'épreuve",
    deleteEventHint: "Possible tant que personne n'a pronostiqué cette épreuve.",
    needsFinal: "Pas de prono : ajoute la finale",
    title: "Compétitions",
    subtitle: "La prochaine par date est mise en avant sur l'accueil.",
    sections: "Sections du back-office",
    groups: { game: "Jeu", data: "Données", community: "Communauté" },
    todo: (count: number) => `${count} à traiter`,
    section: {
      dashboard: "Tableau de bord",
      competitions: "Compétitions",
      athletes: "Athlètes",
      results: "Résultats",
      disciplines: "Disciplines",
      scale: "Barème",
      manager: "Manager",
      leagues: "Ligues",
      players: "Joueurs",
      demoPlayers: "Joueurs démo",
      clubs: "Clubs",
      history: "Historique",
    },
    create: "+ Nouvelle compétition",
    newTitle: "Nouvelle compétition",
    createSubmit: "Créer la compétition",
    featured: "★ À la une",
    list: { coming: "À venir", past: "Terminées" },
    none: "Aucune compétition.",
    /** The filters of the list (#647), kept in the address. */
    filters: {
      scope: "Portée",
      venue: "Lieu",
      level: "Niveau",
      status: "Statut",
      allFeminine: "Toutes",
      allMasculine: "Tous",
      scopes: { international: "Internationales", france: "France" },
      venues: { indoor: "Salle", outdoor: "Plein air" },
      statuses: { coming: "À venir", live: "En cours", past: "Terminées" },
      count: (n: number) => (n <= 1 ? `${n} compétition` : `${n} compétitions`),
      reset: "Réinitialiser",
      empty: "Aucune compétition ne correspond à ces filtres",
    },
    /** A competition level: the known ones by name, the others from their code. */
    level: (level: string) =>
      LEVEL_NAMES[level] ??
      level
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    scope: { international: "Internationale", france: "Française" },
    type: "Type",
    venueLabel: "Lieu",
    venue: { outdoor: "En plein air", indoor: "En salle" },
    /** The chip of an indoor competition (#642); nothing for outdoor. */
    indoorChip: "Salle",
    city: "Ville",
    startsOn: "Début",
    endsOn: "Fin",
    events: "épreuves",
    entered: "engagés",
    tabs: "Contenu de la compétition",
    eventsTab: (n: number) => `Épreuves (${n})`,
    athletesTab: (n: number) => `Engagés (${n})`,
    noEvent: "Aucune épreuve : ajoute la première ci-dessous.",
    entries: (n: number) => `${n} au départ`,
    addEvent: "+ Ajouter une épreuve",
    discipline: "Discipline",
    round: "Tour",
    localStart: "Horaire (heure de Paris)",
    timeHint: "Horaires en heure de Paris, quel que soit le pays de la compétition.",
    lock: "Verrouillage",
    lockBefore: (m: number) => (m === 0 ? "Au départ" : `${m} min avant`),
    addEventSubmit: "Ajouter l'épreuve",
    enter: "Engager",
    enterHint:
      "Les listes de départ se choisissent parmi les engagés (tous les athlètes de la discipline si aucun engagé ne la court). Un athlète absent ?",
    noAthlete: "Personne n'est engagé : cherche un athlète ci-dessus.",
    athletesList: "Athlètes engagés",
    withdraw: (name: string) => `Retirer ${name} de la compétition`,
    managerTitle: "Points Manager",
    managerHint:
      "Calculés à chaque feuille de résultats enregistrée : barème World Athletics des titulaires, bonus sportifs et pronos de chaque participant. En secours, relance le même calcul pour toute la compétition.",
    managerCompute: "Recalculer les points Manager",
    managerComputed: (n: number) =>
      `✓ Points Manager recalculés : ${n} ${n <= 1 ? "participant" : "participants"}.`,
  },
  odds: {
    link: "Cotes",
    title: "Cotes",
    titleOf: (event: string) => `Cotes · ${event}`,
    intro:
      "Choisis les athlètes de la liste de départ à proposer, autant que tu veux, et donne une cote à chacun. Plus elle est basse, plus l'athlète est favori.",
    notice:
      "Les pronos s'ouvrent une fois les cotes enregistrées. Elles sont figées au verrouillage.",
    proposed: "Athlètes proposés",
    athlete: "Athlète",
    odds: "Cote",
    none: "Aucun athlète proposé : choisis-les dans la liste de départ ci-dessous.",
    oddsOf: (name: string) => `Cote de ${name}`,
    remove: (name: string) => `Retirer ${name} des athlètes proposés`,
    other: "Autre athlète",
    otherOdds: "Cote d'un autre athlète",
    rest: "Reste de la liste de départ",
    restEmpty: "Tous les athlètes de la liste de départ sont proposés.",
    propose: "Proposer",
    rule: "Au moins un athlète ; une cote est un nombre positif (ex. 1,80). « Autre athlète » compte si un athlète hors de cette liste finit à la place pronostiquée.",
    count: (n: number) => (n <= 1 ? `${n} proposé` : `${n} proposés`),
    invalid: (name: string) => `La cote de « ${name} » doit être un nombre positif (ex. 1,80).`,
    save: "Enregistrer les cotes",
  },
  myPredictions: {
    joker: "🃏 Joker",
  },
  event: {
    back: "Compétitions",
    title: (discipline: string) => `${discipline} — Finale`,
    combined: (n: number) => `Épreuve combinée · ${n} disciplines`,
    combinedNote: "Tu pronostiques le podium final, au total des points.",
    startList: "Liste de départ",
    startListEmpty: "La liste de départ n'est pas encore connue.",
    podium: "Podium officiel",
    podiumEmpty: "Le résultat n'est pas encore connu.",
    podiumStep: (rank: number) => `Place ${rank}`,
    seedNote:
      "Seuls les podiums sont chargés dans le jeu de test. Les listes de départ complètes viendront plus tard.",
  },
  captcha: {
    label: "Vérification anti-robot",
  },
  signIn: {
    title: "Connexion ou inscription",
    subtitle:
      "Pas de mot de passe : on t'envoie un code par e-mail. Première fois ? Ton compte se crée tout seul.",
    /** Reminder of the event the visitor came from (« 100 m femmes »). */
    eventWaiting: (event: string) =>
      `Ton podium du ${event} t'attend. Encore une minute et tu le poses.`,
    emailLabel: "Ton e-mail",
    emailHint: "Jamais affiché aux autres joueurs.",
    send: "Recevoir mon code",
    sending: "Envoi…",
    perks: [
      "Gratuit, sans argent en jeu",
      "Ton profil en 30 secondes",
      "Un jeu du podcast FrenchTrack",
    ],
    codeTitle: "Regarde tes e-mails",
    sentTo: "Code envoyé à",
    codeLabel: "Code reçu par e-mail",
    pasteCode: "Coller le code",
    noCodeToPaste: "Pas de code dans le presse-papiers",
    verify: "Me connecter",
    verifying: "Vérification…",
    linkTip: "Ou plus simple : ouvre le lien du message sur ce téléphone.",
    resend: "Renvoyer un code",
    resent: "Un nouveau code vient d'être envoyé.",
    changeEmail: "Autre e-mail",
    codeNote: "Pas reçu ? Regarde dans tes spams. Le code expire au bout d'une heure.",
    linkInvalid: "Ce lien ne fonctionne plus. Demande un nouveau code.",
  },
  account: {
    signIn: "Se connecter",
    myProfile: "Mon profil",
    backOffice: "Back-office",
  },
  badges: {
    nostradamus: { emoji: "🔮", name: "Nostradamus", rule: "Un podium parfait" },
    chasseur: { emoji: "🎯", name: "Chasseur", rule: "3 vainqueurs trouvés" },
    flair: { emoji: "🦊", name: "Flair", rule: "Un coup de flair" },
    serie: { emoji: "🔥", name: "Série", rule: "5 épreuves de suite avec des points" },
    bleus: { emoji: "🇫🇷", name: "Bleus", rule: "Un vainqueur français trouvé" },
    fidele: { emoji: "📅", name: "Fidèle", rule: "Un prono sur chaque épreuve d'une journée" },
  },
  seasonCard: {
    brand: "FRENCH TRACK PRONO",
    title: "Ma saison",
    points: ptsUnit,
    rank: (rank: number, players: number) =>
      `${ordinal(rank)} sur ${players} joueur${players > 1 ? "s" : ""}`,
    notRanked: "Pas encore classé",
    bestShot: "MON MEILLEUR COUP",
    noBestShot: "À venir…",
    footer: "Pronostique les podiums d'athlé avec FrenchTrack",
    share: "Partager ma carte de saison",
    preparing: "Préparation de la carte…",
    error: "La carte n'a pas pu être créée. Réessaie dans un instant.",
    fileName: "ma-saison-french-track-prono.png",
    shareTitle: "Ma saison sur French Track Prono",
  },
  predictionHistory: {
    latest: "Mes derniers pronos",
    all: "Tous mes pronos",
    title: "Tous mes pronos",
    empty: "Pas encore de prono : choisis une épreuve et compose ton podium.",
    emptyCompetition: "Aucun prono sur cette compétition.",
    pending: "En attente",
    joker: "Joker",
    other: "Autre athlète",
    chooseCompetition: "Choisir la compétition",
    hit: {
      exact: "bonne place",
      misplaced: "sur le podium, mauvaise place",
      missed: "pas sur le podium",
      pending: "",
    },
  },
  clubRanking: {
    title: "Classement des clubs",
    podium: "Podium des clubs",
    myClub: (name: string, rank: number, clubs: number) =>
      `${name} : ${ordinal(rank)} sur ${clubs}`,
    average: (points: string) => `${points} pts de moyenne`,
    notRanked: (name: string, min: number) =>
      `${name} n'est pas encore classé : il faut ${min} joueurs du club avec des points.`,
    addClub: "Ajoute ton club pour le faire grimper",
    empty: "Aucun club classé pour l'instant.",
    rank: (rank: number) => `${ordinal(rank)} :`,
    players: (n: number) => `${n} joueur${n > 1 ? "s" : ""}`,
    rule: (min: number) =>
      `Moyenne des points des joueurs du club, toutes compétitions, à partir de ${min} joueurs.`,
  },
  profile: {
    title: "Mon profil",
    season: "Saison",
    account: "Compte",
    pseudo: "Pseudo",
    email: "E-mail",
    private: "Privé",
    badges: "Badges",
    badgeEarned: "Gagné",
    badgeLocked: "À débloquer",
    nextBadge: (name: string, left: number) => `Prochain : ${name} (encore ${left})`,
    allBadges: "Tous les badges sont à toi !",
    emailPrivate: "Ton e-mail reste privé : il n'apparaît jamais dans l'application.",
    signOut: "Se déconnecter",
    signingOut: "Déconnexion en cours…",
    deleteLink: "Supprimer mon compte",
    joined: (club: string | null, date: string) =>
      `${club ? `${club} · ` : ""}joueur depuis le ${date}`,
    rankOf: (rank: number, players: number) => `${ordinal(rank)} sur ${players}`,
    notRanked: "pas encore classé",
    myStats: "Mes stats",
    stat: {
      predictions: "pronos",
      perfect: "podiums parfaits",
      winners: "vainqueurs",
      success: "pronos qui rapportent",
      streak: "meilleure série",
      joker: "joker joué",
    },
    jokerYes: "✓",
    jokerNo: "–",
    mySeason: "Ma saison",
    curve: (events: number, total: number) =>
      `Points cumulés : de 0 à ${total} en ${events} ${events <= 1 ? "épreuve" : "épreuves"}`,
    curveEmpty: "Ta courbe démarre après ta première épreuve calculée.",
    bestShot: "Mon meilleur coup",
    bestPerfect: (event: string) => `Podium parfait au ${event}`,
    bestEvent: (event: string) => `${event}`,
    bestOdds: (odds: string) => `Avec une cote à ${odds}`,
    bestPoints: (n: number) => `+${pts(n)}`,
    noBestShot: "Ton meilleur coup apparaîtra ici après ta première épreuve calculée.",
    strong: "Mes disciplines fortes",
    noStrong: "Tes disciplines fortes apparaîtront après quelques épreuves calculées.",
  },
  globalError: {
    title: "Oups, la page est tombée",
    body: "Une erreur nous empêche de l'afficher. On est prévenus ; réessaie dans un instant.",
    retry: "Réessayer",
  },
  notifications: {
    title: "Notifications",
    description:
      "Un rappel avant le verrouillage d'une finale pas encore pronostiquée, et tes points dès qu'ils tombent. Une par heure au plus.",
    turnOn: "Activer sur cet appareil",
    turnOff: "Désactiver sur cet appareil",
    on: "Activées sur cet appareil.",
    denied: "Ton navigateur bloque les notifications de ce site : autorise-les dans ses réglages.",
    unsupported:
      "Ton navigateur ne gère pas les notifications. Sur iPhone, ajoute d'abord l'appli à l'écran d'accueil.",
    failed: "Les notifications n'ont pas pu être activées. Réessaie dans un instant.",
  },
  editProfile: {
    title: "Modifier mon profil",
    subtitle: "Ton pseudo, ton dossard, ton club. Sexe et disciplines restent privés.",
    link: "Modifier mon profil",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Ton profil est à jour.",
    cancel: "Retour au profil",
    club: "Club",
    noClub: "Aucun club",
    toValidate: "à valider",
  },
  changeEmail: {
    title: "Changer d'e-mail",
    current: (email: string) => `Tu te connectes avec ${email}.`,
    link: "Changer",
    emailLabel: "Ta nouvelle adresse",
    emailHint: "On t'y envoie un code. Ton adresse ne change qu'une fois le code saisi.",
    send: "Recevoir un code",
    sending: "Envoi…",
    sent: (email: string) => `Code envoyé à ${email}. Saisis-le ici (valable 10 minutes).`,
    codeLabel: "Code reçu",
    confirm: "Confirmer ma nouvelle adresse",
    confirming: "Vérification…",
    done: "Ta nouvelle adresse est enregistrée : utilise-la pour te connecter.",
  },
  deleteAccount: {
    title: "Supprimer mon compte",
    subtitle: "C'est définitif.",
    whatGoes:
      "Ton profil, tes pronos, tes points, tes réactions et tes ligues disparaissent. Une ligue que tu as créée passe au membre le plus ancien, ou disparaît si tu y es seul.",
    confirmLabel: "Je comprends que c'est définitif",
    submit: "Supprimer définitivement",
    submitting: "Suppression…",
    cancel: "Garder mon compte",
    done: "Ton compte est supprimé. Merci d'avoir joué !",
    home: "Retour à l'accueil",
  },
  bib: {
    /** Printed at the top of the big bib, like the organiser's name on a real one. */
    brand: "FRENCH TRACK",
    label: (number: number) => `Dossard ${number}`,
    legend: "Ton dossard",
    numberLabel: "Numéro",
    numberHint: "De 0 à 999. Plusieurs joueurs peuvent avoir le même.",
    colorLabel: "Couleur",
    colors: {
      blue: "Bleu",
      red: "Rouge",
      gold: "Or",
      green: "Vert",
      white: "Blanc",
      night: "Nuit",
    },
  },
  welcome: {
    title: "Bienvenue !",
    subtitle: "Choisis comment les autres joueurs te verront. C'est tout.",
    pseudoLabel: "Ton pseudo",
    pseudoHint:
      "2 à 24 caractères : lettres, chiffres, espace, _ - . Visible par les autres joueurs.",
    ageLabel: "J'ai 15 ans ou plus",
    ageHint: "Obligatoire pour jouer.",
    sexLabel: "Tu es (facultatif)",
    sexF: "Femme",
    sexM: "Homme",
    sexNone: "Je préfère ne pas le dire",
    disciplinesLabel: "Tes disciplines (facultatif)",
    disciplinesHint: "Coche celles que tu pratiques, autant que tu veux. Visible par toi seul.",
    submit: "C'est parti : mon premier prono",
    submitting: "Création…",
    later: "Ton club et tes disciplines : plus tard, depuis ton profil.",
  },
  clubPicker: {
    legend: "Ton club (facultatif)",
    searchLabel: "Cherche ton club",
    searchHint:
      "Tape quelques lettres du nom ou de la ville. Ton club est visible par les autres joueurs.",
    results: "Clubs trouvés",
    none: "Aucun club trouvé.",
    change: "Changer",
    missing: "Mon club n'est pas dans la liste",
    newNameLabel: "Nom de ton club",
    newNameHint: "Il sera vérifié par l'équipe avant d'apparaître dans la liste.",
    newCityLabel: "Ville du club",
    backToSearch: "Chercher dans la liste",
  },
  countdown: {
    locksIn: (duration: string) => `Verrouillage dans ${duration}`,
    locked: "Verrouillé",
    locksInLabel: "Verrouillage dans",
    day: "j",
    /** "2 j 4 h", "3 h 5 min", "42 min", "4 min 12 s", "38 s". */
    duration: (parts: { days: number; hours: number; minutes: number; seconds: number }) => {
      const { days, hours, minutes, seconds } = parts;
      if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
      if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
      if (minutes >= 10) return `${minutes} min`;
      if (minutes > 0) return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
      return `${seconds} s`;
    },
  },
  picker: {
    profileLabel: (name: string) => `Fiche de ${name}`,
    podium: "Mon podium",
    athletes: "Liste de départ",
    emptyStep: "Touche un athlète",
    choose: "Choisir",
    seasonBest: (mark: string) => `SB ${mark}`,
    personalBest: (mark: string) => `PB ${mark}`,
    odds: (odds: number) => `×${odds.toFixed(2).replace(".", ",")}`,
    oddsLabel: (odds: number) => `cote ${odds.toFixed(2).replace(".", ",")}`,
    proposed: "Athlètes proposés",
    other: "Autre athlète",
    otherHint: "N'importe quel athlète hors de cette liste",
    marksTitle: "Tes perfs (facultatif)",
    marksHint: (tolerance: string) =>
      `Une perf est juste à ${tolerance} près de la marque officielle. Laisse vide pour ne pas parier.`,
    markLabel: (name: string) => `Perf de ${name}`,
    markPlaceholder: { time: "10.85", distance: "8.15", points: "8250" },
    /** « Entre 5,00 m et 20,00 m pour le triple saut. » */
    markOutOfRange: (min: string, max: string, discipline: string) => {
      const name = discipline.charAt(0).toLowerCase() + discipline.slice(1);
      return `Entre ${min} et ${max} pour ${/^[aeiouyhéè]/i.test(name) ? "l'" : "le "}${name}.`;
    },
    /** A bound of a range: « 20,00 m », « 9,00 s », « 15:00 », « 6:00:00 », « 10000 pts ». */
    rangeMark: (value: number, unit: "time" | "distance" | "points") => {
      if (unit === "points") return `${Math.round(value)} pts`;
      if (unit === "distance") return `${value.toFixed(2).replace(".", ",")} m`;
      if (value < 60) return `${value.toFixed(2).replace(".", ",")} s`;
      const hours = Math.floor(value / 3600);
      const minutes = Math.floor(value / 60) % 60;
      const seconds = Math.round(value % 60);
      const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
      return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
    },
    tolerance: (value: number, unit: "time" | "distance" | "points") =>
      `±${unit === "points" ? Math.round(value) : value.toFixed(2).replace(".", ",")} ${{ time: "s", distance: "m", points: "pts" }[unit]}`,
    oddsHint: "La cote multiplie tes points : plus elle est haute, plus le pari rapporte.",
    stepLabel: (rank: 1 | 2 | 3, name: string | null) =>
      `${["1re", "2e", "3e"][rank - 1]} place : ${name ?? "vide"}`,
    athleteLabel: (name: string, rank: 1 | 2 | 3 | null) =>
      rank ? `${name}, placé ${["1er", "2e", "3e"][rank - 1]}. Toucher pour le retirer` : name,
    hint: "Touche les athlètes dans l'ordre : 1er, 2e, 3e.",
    hintComplete: "Touche un athlète déjà placé pour le retirer, ou une marche pour la changer.",
  },
  result: {
    eyebrow: (name: string) => `Résultat · ${name}`,
    winner: (name: string) => `${name} s'impose`,
    points: (points: number) => gain(points),
    notComputed: "Les points de cette épreuve ne sont pas encore calculés.",
    vsTitle: "Ton prono vs officiel",
    outcome: { exact: "exact", on_podium: "podium", off: "hors podium" },
    total: "Total",
    totalPoints: pts,
  },
  reveal: {
    title: "Les pronos",
    filtersLabel: "Voir les pronos de",
    all: "Tous",
    count: (n: number) => (n <= 1 ? `${n} prono` : `${n} pronos`),
    me: "Toi",
    joker: "🃏 Joker",
    flair: "🎯 Coup de flair",
    flairLine: "Vu venir quand personne ne regardait.",
    picksTitle: "Qui ont-ils vu gagner ?",
    picksOthers: "Autres",
    picksWinner: "vainqueur",
    picksLabel: (name: string, percent: number) => `${name} : ${percent} %`,
    hiddenTitle: "Les pronos des autres se dévoilent au verrouillage.",
    hiddenText: "D'ici là, chacun garde son podium pour soi.",
    emptyAll: "Personne n'a pronostiqué cette épreuve.",
    emptyLeague: "Personne dans cette ligue n'a pronostiqué cette épreuve.",
    emptyText: "Même Duplantis commence à 5 m. Rendez-vous à la prochaine.",
    seeEvents: "Voir les autres épreuves",
    places: { first: "1er", second: "2e", third: "3e" },
  },
  reactions: {
    group: "Réagir à ce prono",
    names: {
      "🔥": "feu",
      "😂": "mort de rire",
      "😮": "surpris",
      "👏": "bravo",
      "🤡": "clown",
      "🎯": "dans le mille",
    },
    label: (name: string, count: number) =>
      count === 0
        ? `Réagir : ${name}`
        : `Réagir : ${name}, ${count} ${count === 1 ? "réaction" : "réactions"}`,
  },
  prediction: {
    joker: "🃏 Joker : points × 2",
    jokerHint: "Un seul par compétition.",
    save: "Enregistrer mon podium",
    saving: "Enregistrement…",
    saved: "✓ Podium enregistré. Tu peux le modifier jusqu'au verrouillage.",
    /** The save, on the button and in the notice at the top of the screen. */
    savedShort: "✓ Podium enregistré",
    jokerUsedHere: "🃏 Joker utilisé sur cette épreuve",
    none: "Tu n'avais pas pronostiqué cette épreuve : 0 point.",
    visitorTitle: "Connecte-toi pour pronostiquer",
    visitorText: "Il faut un compte pour enregistrer ton podium.",
    signIn: "Se connecter",
    leagueTitle: "Joue aussi avec tes amis",
    leagueText: (competition: string) =>
      `Ton podium compte au classement général et à celui de ${competition}. Dans une ligue, tu te mesures aussi à tes amis.`,
    leagueCreate: "Créer une ligue privée",
    leagueCreatePublic: "Créer une ligue publique",
    leagueJoin: "Rejoindre une ligue publique",
    leagueAdd: (name: string) => `Ajouter à ma ligue « ${name} »`,
  },
  adminLeagues: {
    title: "Ligues",
    subtitle: "Toutes les ligues ; chaque action est notée dans l'historique.",
    summary: (total: number, publicCount: number, reported: number) =>
      `${total} ${total <= 1 ? "ligue" : "ligues"} · ${publicCount} ${publicCount <= 1 ? "publique" : "publiques"} · ${reported} ${reported <= 1 ? "signalée" : "signalées"}`,
    listLabel: "Ligues",
    searchLabel: "Chercher une ligue",
    searchPlaceholder: "Nom de la ligue ou créateur",
    filter: {
      all: "Toutes",
      reported: "Signalées",
      public: "Publiques",
      private: "Privées",
      empty: "Vides",
    },
    column: {
      name: "Ligue",
      kind: "Type",
      owner: "Créateur",
      members: "Membres",
      reports: "Signalements",
      created: "Créée le",
    },
    public: "Publique",
    private: "Privée",
    noOwner: "Compte supprimé",
    members: (n: number, capacity: number) => `${n} / ${capacity} membres`,
    reports: (n: number) => `${n} ${n <= 1 ? "signalement" : "signalements"}`,
    noReport: "—",
    created: (date: string, owner: string) => `Créée par ${owner} le ${date}`,
    competitions: "Compétitions",
    noCompetition: "Aucune compétition pour l'instant.",
    moderationTitle: (n: number) => `${n} ${n <= 1 ? "signalement" : "signalements"} à traiter`,
    renameLabel: "Nouveau nom",
    rename: "Renommer",
    renamed: "Ligue renommée.",
    dismiss: "Ignorer",
    dismissed: "Signalements effacés.",
    remove: "Supprimer…",
    removeMany: "Supprimer",
    removeTitle: (count: number, name?: string) =>
      name
        ? `Supprimer la ligue « ${name} » ?`
        : `Supprimer ${count <= 1 ? "cette ligue" : `ces ${count} ligues`} ?`,
    removeBody:
      "Ses membres, son classement et ses signalements partent avec elle. C'est définitif.",
    removeSubmit: "Supprimer",
    removedCount: (n: number) => (n <= 1 ? "Ligue supprimée." : `${n} ligues supprimées.`),
    dismissMany: "Ignorer les signalements",
    dismissedCount: (n: number) =>
      n <= 1 ? "Signalements effacés." : `Signalements effacés sur ${n} ligues.`,
    membersTitle: "Classement et membres",
    membersLoading: "Chargement des membres…",
    owner: "Créateur",
    points: pts,
    rank: (n: number) => ordinal(n),
    removeMember: (pseudo: string) => `Retirer ${pseudo}`,
    removeMemberTitle: (pseudo: string) => `Retirer ${pseudo} de la ligue ?`,
    removeMemberBody: "Il pourra la rejoindre à nouveau s'il a le code ou si elle est publique.",
    removeMemberSubmit: "Retirer",
    memberRemoved: "Membre retiré.",
  },
  adminClubs: {
    title: "Clubs",
    subtitle:
      "Les clubs importés chaque mois et ceux saisis par les joueurs. Valide, corrige, ajoute ou supprime ; chaque action est notée dans l'historique.",
    searchLabel: "Nom ou ville",
    pending: "À valider",
    source: { import: "Importé", player: "Saisi par un joueur", admin: "Ajouté par l'admin" },
    players: (n: number) => `${n} ${n <= 1 ? "joueur" : "joueurs"}`,
    nameLabel: "Nom",
    cityLabel: "Ville",
    departmentLabel: "Département",
    newClub: "+ Nouveau club",
    create: "Créer le club",
    save: "Enregistrer",
    validate: "Valider",
    pendingAction: "…",
    done: "✓ C'est fait.",
    summary: (total: number, pending: number) =>
      `${total} ${total <= 1 ? "club" : "clubs"} · ${pending} à valider`,
    listLabel: "Clubs",
    searchPlaceholder: "Nom ou ville",
    filter: { pending: "À valider", validated: "Validés", withPlayers: "Avec joueurs" },
    origin: "Origine",
    originAll: "Origine : toutes",
    originShort: { import: "Import", player: "Joueur", admin: "Admin" },
    department: "Département",
    departmentAll: "Département : tous",
    column: {
      name: "Nom",
      city: "Ville",
      department: "Dép.",
      origin: "Origine",
      players: "Joueurs",
      added: "Ajouté le",
      status: "Statut",
    },
    validated: "Validé",
    likely: (name: string) => `⚠ Ressemble à ${name}`,
    added: (date: string, source: string) => `Ajouté le ${date} · ${source}`,
    removeMany: "Supprimer",
    removeTitle: (count: number) =>
      count <= 1 ? "Supprimer ce club ?" : `Supprimer ces ${count} clubs ?`,
    removeBody: "Leurs joueurs n'auront plus de club et recevront un message. C'est définitif.",
    removeSubmit: "Supprimer",
    validatedCount: (n: number) => (n <= 1 ? "Club validé." : `${n} clubs validés.`),
    removedCount: (n: number) => (n <= 1 ? "Club supprimé." : `${n} clubs supprimés.`),
    saved: "Club enregistré.",
    duplicate: "Doublon probable",
    mergeInto: (name: string) => `Fusionner dans ${name}`,
    mergeHint: "Ses joueurs passent sur ce club et reçoivent un message.",
    mergeOther: "Fusionner dans un autre club",
    mergeSearch: "Club où fusionner",
    mergeTitle: (from: string, into: string) => `Fusionner « ${from} » dans « ${into} » ?`,
    mergeBody:
      "Le club en double disparaît ; ses joueurs passent sur l'autre et reçoivent un message.",
    mergeSubmit: "Fusionner",
    merged: (name: string, players: number) =>
      `Fusionné dans ${name} : ${players} ${players <= 1 ? "joueur déplacé" : "joueurs déplacés"}.`,
    validateAsIs: "Valider tel quel",
    removeOne: "Supprimer",
  },
  demoLogin: {
    title: "Joueurs démo",
    intro:
      "Préproduction seulement : connecte-toi en tant qu'un joueur démo pour voir l'application avec ses ligues, son équipe Manager et ses pronos.",
    listLabel: "Joueurs démo",
    empty: "Aucun joueur démo pour le moment : charge le jeu de démo de la préproduction.",
    signInAs: "Se connecter en tant que",
    signInAsLabel: (pseudo: string) => `Se connecter en tant que ${pseudo}`,
    signingIn: "Connexion en cours…",
    bannerLabel: "Session de démo",
    banner: (pseudo: string) => `Tu joues en tant que ${pseudo}`,
    backToMe: "Revenir à mon compte",
    goingBack: "Retour en cours…",
  },
  adminPlayers: {
    title: "Joueurs",
    subtitle:
      "Bloqué, un joueur ne pronostique plus, ne rejoint plus de ligue et sort des classements. Chaque action est notée dans l'historique.",
    summary: (total: number, active: number, blocked: number) =>
      `${total} inscrits · ${active} actifs cette semaine · ${blocked} ${blocked <= 1 ? "bloqué" : "bloqués"}`,
    listLabel: "Joueurs",
    searchLabel: "Chercher un joueur",
    searchPlaceholder: "Pseudo",
    filter: {
      all: "Tous",
      fresh: "Nouveaux",
      idle: "Inactifs 30 j",
      noPrediction: "Sans prono",
      blocked: "Bloqués",
    },
    club: "Club",
    clubAll: "Club : tous",
    column: {
      player: "Joueur",
      club: "Club",
      points: "Points",
      predictions: "Pronos",
      leagues: "Ligues",
      activity: "Dernière activité",
      joined: "Inscription",
    },
    points: pts,
    predictions: (n: number) => `${n} ${n <= 1 ? "prono" : "pronos"}`,
    blocked: "Bloqué",
    admin: "Admin",
    noClub: "Sans club",
    since: (date: string) => `Inscrit le ${date}`,
    stat: { rank: "général", predictions: "pronos", leagues: "ligues" },
    notRanked: "—",
    leaguesTitle: "Ses ligues",
    leagueRank: (name: string, rank: number, size: number) =>
      `${name} · ${ordinal(rank)} sur ${size}`,
    noLeague: "Aucune ligue.",
    leaguesLoading: "Chargement des ligues…",
    reportsTitle: "Signalements",
    reports: (n: number) =>
      n === 0
        ? "Aucun"
        : `${n} ${n <= 1 ? "signalement reçu" : "signalements reçus"} par ses ligues publiques`,
    block: "Bloquer",
    unblock: "Débloquer",
    blockedCount: (n: number) => (n <= 1 ? "Joueur bloqué." : `${n} joueurs bloqués.`),
    unblockedCount: (n: number) => (n <= 1 ? "Joueur débloqué." : `${n} joueurs débloqués.`),
    remove: "Supprimer…",
    removeMany: "Supprimer",
    removeTitle: (count: number, pseudo?: string) =>
      pseudo
        ? `Supprimer le compte de ${pseudo} ?`
        : `Supprimer ${count <= 1 ? "ce compte" : `ces ${count} comptes`} ?`,
    removeBody: "Pronos, points et ligues créées partent avec le compte. C'est définitif.",
    removeSubmit: "Supprimer",
    removedCount: (n: number) => (n <= 1 ? "Compte supprimé." : `${n} comptes supprimés.`),
    adminNote: "Un admin ne se bloque ni ne se supprime.",
    today: "Aujourd'hui",
    yesterday: "Hier",
    daysAgo: (n: number) => `Il y a ${n} j`,
  },
  errors: {
    EVENTS_UNAVAILABLE: "Impossible de charger les épreuves pour le moment.",
    EVENT_NOT_FOUND: "Cette épreuve n'existe pas.",
    PROGRAM_ALERT_UNAVAILABLE: "L'alerte n'a pas pu être enregistrée. Réessaie.",
    EMAIL_INVALID: "Cette adresse e-mail n'a pas l'air valide.",
    CODE_INVALID: "Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau.",
    AUTH_UNAVAILABLE: "La connexion ne marche pas pour le moment. Réessaie dans un instant.",
    CAPTCHA_FAILED: "La vérification anti-robot n'a pas abouti. Coche-la à nouveau puis réessaie.",
    ACCOUNT_BLOCKED:
      "Ton compte est bloqué par l'équipe : tu ne peux plus pronostiquer ni rejoindre de ligue. Écris-nous pour en savoir plus.",
    PLAYER_UNKNOWN: "Ce joueur n'existe plus (ou c'est un admin).",
    PLAYERS_UNAVAILABLE:
      "La liste des joueurs est indisponible pour le moment. Réessaie dans un instant.",
    EMAIL_UNCHANGED: "C'est déjà ton adresse de connexion.",
    EMAIL_TAKEN: "Cette adresse est déjà utilisée par un autre compte.",
    AGE_NOT_CONFIRMED: "Tu dois avoir 15 ans ou plus pour jouer.",
    PSEUDO_INVALID:
      "Ce pseudo n'est pas valable : 2 à 24 caractères (lettres, chiffres, espace, _ - .).",
    PSEUDO_TAKEN: "Ce pseudo est déjà pris, essaie-en un autre.",
    PSEUDO_BANNED:
      "Ce pseudo n'est pas possible (insulte, nom officiel ou lien). Choisis-en un autre.",
    BIB_NUMBER_INVALID: "Ton numéro de dossard : de 0 à 999, sans zéro devant.",
    BIB_COLOR_INVALID: "Choisis une des six couleurs de dossard.",
    PROFILE_EXISTS: "Tu as déjà un profil.",
    PROFILE_UNAVAILABLE: "Le profil n'est pas disponible pour le moment. Réessaie dans un instant.",
    NOT_ADMIN: "Seul un administrateur peut faire ça.",
    DEMO_LOGIN_DISABLED: "Cette page n'existe qu'en préproduction.",
    DEMO_PLAYER_ONLY:
      "Seul un joueur démo (adresse en @example.test, pas un admin) peut être incarné.",
    ATHLETE_NOT_PROPOSED: "Choisis parmi les athlètes proposés ou « Autre athlète ».",
    ATHLETE_NOT_IN_EVENT: "Cet athlète ne participe pas à cette épreuve.",
    RESULT_INVALID:
      "Résultat incomplet : au moins trois athlètes différents, rangs 1 à 3 (les ex æquo partagent un rang).",
    RESULTS_UNAVAILABLE:
      "Les résultats ne sont pas disponibles pour le moment. Réessaie dans un instant.",
    LEAGUE_NAME_INVALID:
      "Ce nom n'est pas valable : 2 à 40 caractères (lettres, chiffres, emoji, ponctuation simple).",
    LEAGUE_NAME_BANNED:
      "Ce nom n'est pas possible pour une ligue (insulte, nom officiel ou lien). Choisis-en un autre.",
    LEAGUE_FAMILY_INVALID: "Cette famille d'épreuves n'existe pas.",
    LEAGUE_ALL_EVENTS: "Cette ligue compte déjà toutes les épreuves.",
    LEAGUE_CODE_UNKNOWN: "Ce code ne correspond à aucune ligue. Vérifie-le auprès de ton ami.",
    ALREADY_MEMBER: "Tu fais déjà partie de cette ligue.",
    LEAGUE_FULL: "Cette ligue est complète (50 membres au maximum).",
    LEAGUE_TOO_MANY_ATTEMPTS:
      "Trop de codes erronés : réessaie dans une heure, ou demande le lien d'invitation à ton ami.",
    LEAGUE_NOT_FOUND: "Cette ligue n'existe pas ou tu n'en fais pas partie.",
    LEAGUE_OWNER_MUST_HAND_OVER:
      "Tu as créé cette ligue : confie-la d'abord à un autre membre avant de la quitter.",
    NOT_LEAGUE_OWNER: "Seul le créateur de la ligue peut faire ça.",
    LEAGUE_MEMBER_UNKNOWN: "Ce joueur ne fait pas partie de la ligue.",
    LEAGUES_UNAVAILABLE:
      "Les ligues ne sont pas disponibles pour le moment. Réessaie dans un instant.",
    CLUBS_UNAVAILABLE:
      "La liste des clubs est indisponible pour le moment. Réessaie dans un instant.",
    NOTIFICATIONS_UNAVAILABLE:
      "Les notifications ne peuvent pas être activées pour le moment. Réessaie dans un instant.",
    SEX_INVALID: "Choisis Femme, Homme ou « Je préfère ne pas le dire ».",
    CLUB_NAME_INVALID: "Le nom du club doit faire entre 2 et 120 caractères.",
    CLUB_NAME_BANNED: "Ce nom de club n'est pas possible (insulte, nom officiel ou lien).",
    CLUB_UNKNOWN: "Ce club n'existe plus dans la liste. Cherche-le à nouveau.",
    PROFILE_DETAILS_EMPTY: "Choisis ton club ou au moins une discipline.",
    CLUB_MERGE_SAME: "Choisis un autre club que celui à fusionner.",
    LEAGUE_OWNER_STAYS:
      "Le créateur ne se retire pas : il passe la main, ou supprime la ligue entière.",
    RANKING_UNAVAILABLE:
      "Le classement n'est pas disponible pour le moment. Réessaie dans un instant.",
    RESULT_MISSING: "Saisis d'abord le résultat officiel de cette épreuve.",
    RESULT_INCOMPLETE: "Le podium officiel est incomplet : corrige le résultat avant de calculer.",
    EVENT_NOT_LOCKED: "Les pronos de cette épreuve ne sont pas encore fermés.",
    POINTS_UNAVAILABLE:
      "Les points ne sont pas disponibles pour le moment. Réessaie dans un instant.",
    INVALID_REACTION: "Cette réaction n’existe pas.",
    REACTION_NOT_ALLOWED: "Tu peux réagir aux pronos des autres une fois l’épreuve verrouillée.",
    REVEAL_UNAVAILABLE:
      "Les pronos des autres ne sont pas disponibles pour le moment. Réessaie dans un instant.",
    PODIUM_INVALID: "Choisis trois athlètes différents pour ton podium.",
    PREDICTION_LOCKED:
      "Trop tard : cette épreuve vient d'être verrouillée. Ton podium n'a pas été enregistré.",
    SCORING_RULE_INVALID:
      "Une valeur du barème est un nombre positif (le seuil du coup de flair : au plus 1).",
    SCORING_RULE_UNKNOWN: "Cette ligne du barème n'existe pas.",
    SCORING_RULES_UNAVAILABLE:
      "Le barème ne peut pas être lu pour l'instant. Réessaie dans un moment.",
    ODDS_NOT_READY:
      "Les cotes de cette épreuve arrivent bientôt : les pronos s'ouvriront avec elles.",
    ROUND_NOT_READY: "Les pronos ouvrent quand les tours précédents sont terminés.",
    ROUND_UNAVAILABLE: "La qualification n'a pas pu être faite. Réessaie.",
    JOKER_ALREADY_USED: "Tu as déjà utilisé ton joker dans cette compétition.",
    PREDICTION_UNAVAILABLE:
      "Ton prono n'est pas disponible pour le moment. Réessaie dans un instant.",
    DELETION_NOT_CONFIRMED: "Coche la case pour confirmer la suppression.",
    START_LIST_INVALID: "Choisis entre 1 et 24 athlètes, chacun une seule fois.",
    START_LIST_IN_USE:
      "Un athlète déjà pronostiqué ou classé ne peut pas être retiré de la liste de départ.",
    START_LIST_UNAVAILABLE: "La liste de départ n'a pas pu être enregistrée. Réessaie.",
    IMPORT_COUNTRY_MISSING:
      "Chaque nouvel athlète a besoin d'un nom et d'un code pays à trois lettres (FRA, USA…).",
    ADMIN_LOG_UNAVAILABLE: "L'historique n'a pas pu être chargé. Réessaie.",
    ATHLETE_NOT_FOUND: "Cet athlète n'existe pas.",
    TOLERANCE_INVALID: "La tolérance doit être un nombre supérieur à 0.",
    ODDS_INVALID:
      "Propose au moins un athlète de la liste de départ, chacun avec une cote positive, plus la cote « autre athlète ».",
    ODDS_LOCKED: "L'épreuve est verrouillée : les cotes ne changent plus.",
    ODDS_UNAVAILABLE: "Les cotes n'ont pas pu être chargées. Réessaie.",
    COMPETITION_INVALID:
      "Il faut un nom, un type, des dates dans l'ordre, un fuseau horaire valide et un code pays à trois lettres (facultatif).",
    COMPETITION_NOT_FOUND: "Cette compétition n'existe pas.",
    COMPETITION_FINISHED: "Cette compétition est terminée : choisis-en une à venir ou en cours.",
    LEAGUE_COMPETITION_REQUIRED:
      "Choisis au moins une compétition à venir ou en cours pour créer ta ligue.",
    COMPETITIONS_UNAVAILABLE: "Les compétitions n'ont pas pu être chargées. Réessaie.",
    HAS_PREDICTIONS:
      "Des joueurs ont déjà pronostiqué : on ne peut plus supprimer, ni changer le tour d'une épreuve.",
    EVENT_INVALID: "Il faut une discipline, une catégorie, un tour, un horaire et un verrouillage.",
    ATHLETE_ON_START_LIST:
      "Cet athlète est sur une liste de départ de la compétition : retire-le d'abord.",
    ATHLETE_INVALID: "Il faut un nom, un code pays à trois lettres (FRA, USA…) et un genre.",
    MARK_INVALID:
      "Cette marque ne correspond pas à la discipline (ex. 10.62, 1:56.70, 2.04, 8125).",
    MARK_OUT_OF_RANGE: "Cette marque est hors des valeurs possibles pour la discipline.",
    MARK_OUT_OF_RANGE_CONFIRM:
      "Une marque est hors des valeurs habituelles de la discipline. Vérifie-la, puis coche la confirmation pour l'enregistrer quand même.",
    PERFORMANCES_INVALID:
      "Chaque athlète une seule fois, une place à partir de 1, et rien d'autre que le statut pour un DNS, DNF ou DQ.",
    PERFORMANCE_MARK_MISSING: "Un athlète arrivé a besoin d'une place ou d'une marque.",
    PERFORMANCES_UNAVAILABLE: "Impossible de lire ou d'enregistrer les performances. Réessaie.",
    DATE_INVALID: "La date doit être au format AAAA-MM-JJ.",
    DISCIPLINE_NOT_FOUND: "Cette discipline n'existe pas.",
    DISCIPLINE_EXISTS: "Cette discipline existe déjà.",
    DISCIPLINE_NAME_INVALID: "Donne un nom (2 à 40 caractères), une famille et une unité.",
    DISCIPLINES_UNAVAILABLE: "Les disciplines n'ont pas pu être chargées. Réessaie.",
    ATHLETES_UNAVAILABLE: "La fiche athlète n'a pas pu être chargée. Réessaie.",
    ATHLETE_PRICE_INVALID:
      "Le prix est un nombre entier de crédits, au moins 1 (vide pour retirer l'athlète du catalogue).",
    CATALOGUE_UNAVAILABLE: "Le catalogue n'a pas pu être chargé. Réessaie.",
    MANAGER_RULES_INVALID:
      "Ces règles ne permettent pas de jouer : vérifie que les quotas remplissent l'équipe, que l'alignement y tient et qu'un mode de clôture est coché.",
    MANAGER_RULES_UNAVAILABLE: "Les règles Manager n'ont pas pu être chargées. Réessaie.",
    MERCATO_OPEN: "Le mercato de cette ligue a commencé : les inscriptions sont closes.",
    MANAGER_COMPETITIONS_TOO_FEW: "Choisis au moins 6 compétitions.",
    MANAGER_COMPETITIONS_REFUSED:
      "Une de ces compétitions n'est plus disponible (terminée ou retirée). Recharge la page et choisis à nouveau.",
    MANAGER_COMPETITIONS_UNDER_PLAYERS:
      "Avec ces compétitions, la ligue compterait moins de joueurs que d'inscrits : garde-en davantage.",
    MERCATO_COMPETITIONS_MISSING:
      "Il ne reste pas assez de compétitions après la fin prévue du mercato : ajoute une compétition ou raccourcis le mercato.",
    MERCATO_ROUNDS_INVALID: "Choisis une durée de tour de 12, 24, 48 ou 72 heures.",
    MERCATO_PLAYERS_MISSING:
      "Il manque encore des joueurs : le mercato se lance quand tout le monde est là.",
    MANAGER_BID_INVALID: "Une offre est un nombre entier de crédits, au moins 1.",
    MANAGER_BID_BELOW_PRICE: "Une offre est au moins égale au prix de départ de l'athlète.",
    MANAGER_BID_OVER_BUDGET:
      "Tes offres dépasseraient ton budget : baisse une offre ou retire-en une d'abord.",
    MERCATO_NOT_OPEN: "Le mercato de cette ligue n'est pas ouvert : pas d'offre pour l'instant.",
    ATHLETE_NOT_IN_CATALOGUE: "Cet athlète n'est pas dans le catalogue du mercato.",
    ATHLETE_TAKEN: "Cet athlète a déjà été recruté dans cette ligue.",
    ROUND_CLOSING:
      "Le tour d'enchères se termine : les offres rouvrent dans quelques minutes, avec le tour suivant (ou le mercato se clôt).",
    MERCATO_NOT_LAST_BIDDER:
      "Tu ne peux pas clore le mercato : un autre participant peut encore recruter.",
    MANAGER_BIDS_UNAVAILABLE: "Tes offres n'ont pas pu être chargées ou enregistrées. Réessaie.",
    MERCATO_NOT_OVER:
      "Le mercato n'est pas fini : tu aligneras ton équipe une fois qu'il sera clos.",
    LINEUP_LOCKED: "La compétition a commencé : ton alignement est verrouillé.",
    LINEUP_INVALID:
      "Cet alignement ne respecte pas les règles de la ligue : remplis chaque place avec un athlète engagé de ton équipe.",
    LINEUPS_UNAVAILABLE: "Ton alignement n'a pas pu être chargé ou enregistré. Réessaie.",
    ROUND_NOT_FOUND: "Ce tour n'est pas encore clos, ou personne n'y a fait d'offre.",
    COMPETITION_NOT_STARTED:
      "La compétition n'a pas commencé : les points Manager se calculent après le verrouillage.",
    MANAGER_SCORES_UNAVAILABLE:
      "Les points Manager n'ont pas pu être chargés ou calculés. Réessaie.",
    MANAGER_SEASON_NOT_STARTED:
      "Le championnat n'a pas commencé : le calendrier est tiré à la clôture du mercato.",
    MATCHDAY_NOT_FOUND: "Cette journée n'existe pas dans le calendrier de la ligue.",
    MANAGER_SEASON_UNAVAILABLE: "Le championnat n'a pas pu être chargé. Réessaie.",
    MANAGER_HONOURS_UNAVAILABLE: "Le palmarès n'a pas pu être chargé. Réessaie.",
    retry: "Réessayer",
  },
  legal: {
    footer: {
      notice: "Mentions légales",
      privacy: "Confidentialité",
      contact: "Contact",
      contactHref: `mailto:${CONTACT_EMAIL}`,
      socialLabel: "FrenchTrack sur les réseaux",
      social: {
        instagram: "Instagram",
        youtube: "YouTube",
        tiktok: "TikTok",
        podcast: "Le podcast",
      },
      opensNewTab: (name: string) => `${name} (nouvel onglet)`,
    },
    /** Draft written by the agent: the owner validates the final text (issue #172). */
    notice: {
      title: "Mentions légales",
      subtitle: "Qui édite French Track Prono et qui l'héberge.",
      sections: [
        {
          heading: "Éditeur",
          body: [
            "French Track Prono est un jeu gratuit de pronostics d'athlétisme proposé par FrenchTrack, podcast d'athlétisme, à titre non professionnel.",
            "Conformément à l'article 1-1 de la loi pour la confiance dans l'économie numérique, l'identité de l'éditeur est communiquée à l'hébergeur.",
          ],
        },
        {
          heading: "Hébergement",
          body: [
            "Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).",
            "Les données du jeu sont stockées chez Supabase (supabase.com), à Londres (Royaume-Uni).",
          ],
        },
        {
          heading: "Jeu gratuit",
          body: [
            "Aucun argent n'est engagé ni gagné : ce n'est pas un jeu d'argent. Les classements n'ont qu'une valeur amicale.",
            "Les noms des athlètes et les résultats sont des informations publiques. Aucune photo d'athlète n'est utilisée.",
          ],
        },
        {
          id: "contact",
          heading: "Contact",
          body: [`Une question, un bug, une demande sur tes données : ${CONTACT_EMAIL}.`],
        },
      ],
    },
    privacy: {
      title: "Confidentialité",
      subtitle: "Ce qu'on garde sur toi, et comment tout effacer.",
      sections: [
        {
          heading: "Ce qu'on garde",
          body: [
            "Ton adresse e-mail, uniquement pour t'envoyer ton code de connexion. Elle n'est jamais affichée aux autres joueurs.",
            "Ton pseudo et ton dossard (numéro et couleur), visibles des autres joueurs.",
            "Tes pronos (podiums et perfs), tes points, tes ligues et tes réactions. Tes pronos sont visibles des autres une fois l'épreuve verrouillée.",
            "La date à laquelle tu as confirmé avoir 15 ans ou plus.",
            "Si tu actives les notifications : l'adresse d'envoi que ton navigateur nous donne pour cet appareil, supprimée dès que tu les désactives. Les notifications passent par le service de ton navigateur (Google, Apple ou Mozilla), qui les transmet chiffrées sans pouvoir les lire.",
          ],
        },
        {
          heading: "Pourquoi",
          body: [
            "Pour faire tourner le jeu : te connecter, calculer tes points, afficher les classements. Base légale : l'exécution du service que tu demandes en t'inscrivant.",
            "Pas de publicité, pas de revente, pas de pistage : aucun cookie autre que celui qui garde ta session ouverte.",
            "Ton téléphone garde aussi deux petits réglages (astuces déjà vues, invitation à installer l'appli). Ils ne quittent jamais ton appareil.",
          ],
        },
        {
          heading: "15 ans ou plus",
          body: [
            "Le jeu est réservé aux personnes de 15 ans ou plus, l'âge à partir duquel on peut consentir seul en France au traitement de ses données.",
          ],
        },
        {
          heading: "Combien de temps",
          body: [
            "Tant que ton compte existe. Tu peux le supprimer à tout moment depuis ton profil : tout disparaît aussitôt (profil, pronos, points, réactions, ligues).",
            "Un compte sans aucune activité pendant 2 ans est supprimé, après un e-mail pour te prévenir.",
          ],
        },
        {
          heading: "Tes droits",
          body: [
            `Tu peux consulter, corriger ou effacer tes données, demander à les récupérer et t'opposer à leur traitement, en écrivant à ${CONTACT_EMAIL}.`,
            "Tu peux aussi saisir la CNIL (cnil.fr) si tu estimes que tes droits ne sont pas respectés.",
          ],
        },
        {
          heading: "Sous-traitants",
          body: [
            "Vercel (hébergement du site), Supabase (base de données et connexion, à Londres) et Resend (envoi des e-mails de connexion). Le Royaume-Uni bénéficie d'une décision d'adéquation de la Commission européenne. Pour les États-Unis, les transferts se font avec les garanties prévues par le RGPD (cadre de protection des données UE–États-Unis ou clauses contractuelles types).",
          ],
        },
      ],
    },
  },
} as const;
