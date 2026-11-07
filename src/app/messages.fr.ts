// Every visible UI string lives here (French only in v1, no i18n library).
export const messages = {
  app: {
    name: "French Track Prono",
    nameLine1: "French Track",
    nameLine2: "Prono",
    short: "FTP",
    tagline: "Pronostique les podiums d'athlétisme, chambre tes amis, grimpe au classement.",
    description: "Le jeu de pronostics d'athlétisme de la communauté FrenchTrack.",
  },
  home: {
    podiumLabel: "Podium",
    cta: "Voir les épreuves",
  },
  events: {
    title: "Ultimate Championship",
    place: "Budapest · 11 au 13 septembre 2026",
    subtitle: (count: number) => `Budapest · 11 au 13 septembre 2026 · ${count} épreuves`,
    filtersLabel: "Filtrer les épreuves",
    filters: { all: "Toutes", F: "Femmes", M: "Hommes", X: "Mixte" },
    gender: { F: "Femmes", M: "Hommes", X: "Mixte" },
    genderInitial: { F: "F", M: "H", X: "X" },
    status: { upcoming: "À venir", live: "En cours", finished: "Terminé" },
    featured: "Phare",
    provisionalTimes: "Les horaires affichés sont provisoires (jeu de test).",
    empty: "Aucune épreuve pour ce filtre.",
    loading: "Chargement des épreuves…",
  },
  event: {
    back: "Épreuves",
    startList: "Liste de départ",
    startListEmpty: "La liste de départ n'est pas encore connue.",
    podium: "Podium officiel",
    podiumEmpty: "Le résultat n'est pas encore connu.",
    podiumStep: (rank: number) => `Place ${rank}`,
    seedNote:
      "Seuls les podiums sont chargés dans le jeu de test. Les listes de départ complètes viendront plus tard.",
  },
  signIn: {
    title: "Connexion",
    subtitle: "Sans mot de passe : un code arrive par e-mail.",
    emailLabel: "Ton e-mail",
    emailHint: "Jamais affiché aux autres joueurs.",
    send: "Recevoir mon code",
    sending: "Envoi…",
    firstTime: "Pas de compte à créer : si c'est ta première fois, il se crée tout seul.",
    checkTitle: "Vérifie ta boîte mail",
    sentTo: (email: string) => `Code envoyé à ${email}`,
    waysTitle: "Deux façons de te connecter",
    waysBody:
      "Tape le code à 6 chiffres ci-dessous, ou ouvre le lien du message (sur ce téléphone).",
    codeLabel: "Code à 6 chiffres",
    verify: "Me connecter",
    verifying: "Vérification…",
    resend: "Renvoyer",
    resent: "Un nouveau code vient d'être envoyé.",
    changeEmail: "Autre e-mail",
    codeNote: "Le code expire au bout d'une heure. Pense à regarder tes spams.",
    linkInvalid: "Ce lien ne fonctionne plus. Demande un nouveau code.",
  },
  account: {
    signIn: "Se connecter",
    myProfile: (pseudo: string) => `Mon profil : ${pseudo}`,
  },
  profile: {
    title: "Mon profil",
    since: (date: string) => `Joueur depuis le ${date}`,
    emailPrivate: "Ton e-mail reste privé : il n'apparaît jamais dans l'application.",
    signOut: "Se déconnecter",
    signingOut: "Déconnexion…",
    back: "Voir les épreuves",
  },
  welcome: {
    title: "Bienvenue !",
    subtitle: "Dernière étape : ton profil de joueur.",
    pseudoLabel: "Ton pseudo",
    pseudoHint:
      "2 à 24 caractères : lettres, chiffres, espace, _ - . Visible par les autres joueurs.",
    avatarLabel: "Ton avatar",
    ageLabel: "J'ai 15 ans ou plus",
    ageHint: "Obligatoire pour jouer.",
    submit: "Créer mon profil",
    submitting: "Création…",
  },
  countdown: {
    locksIn: (duration: string) => `Verrouillage dans ${duration}`,
    locked: "Verrouillé",
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
    podium: "Ton podium",
    athletes: "Athlètes engagés",
    emptyStep: "Touche un athlète",
    step: (rank: 1 | 2 | 3) => ["1er", "2e", "3e"][rank - 1]!,
    stepLabel: (rank: 1 | 2 | 3, name: string | null) =>
      `${["1re", "2e", "3e"][rank - 1]} place : ${name ?? "vide"}`,
    athleteLabel: (name: string, rank: 1 | 2 | 3 | null) =>
      rank ? `${name}, placé ${["1er", "2e", "3e"][rank - 1]}. Toucher pour le retirer` : name,
    hint: "Touche les athlètes dans l'ordre : 1er, 2e, 3e.",
    hintComplete: "Touche un athlète déjà placé pour le retirer, ou une marche pour la changer.",
  },
  prediction: {
    joker: "🃏 Joker : points × 2",
    jokerHint: "Un seul par compétition.",
    save: "Enregistrer mon podium",
    saving: "Enregistrement…",
    saved: "✓ Podium enregistré. Tu peux le modifier jusqu'au verrouillage.",
    lockedTitle: "Ton podium (verrouillé)",
    jokerUsedHere: "🃏 Joker utilisé sur cette épreuve",
    none: "Tu n'avais pas pronostiqué cette épreuve : 0 point.",
    othersSoon: "Les pronos des autres joueurs apparaîtront bientôt ici.",
    visitorTitle: "Connecte-toi pour pronostiquer",
    visitorText: "Il faut un compte pour enregistrer ton podium.",
    signIn: "Se connecter",
  },
  errors: {
    EVENTS_UNAVAILABLE: "Impossible de charger les épreuves pour le moment.",
    EVENT_NOT_FOUND: "Cette épreuve n'existe pas.",
    EMAIL_INVALID: "Cette adresse e-mail n'a pas l'air valide.",
    CODE_INVALID: "Code incorrect ou expiré. Vérifie-le ou demande-en un nouveau.",
    AUTH_UNAVAILABLE: "La connexion ne marche pas pour le moment. Réessaie dans un instant.",
    AGE_NOT_CONFIRMED: "Tu dois avoir 15 ans ou plus pour jouer.",
    PSEUDO_INVALID:
      "Ce pseudo n'est pas valable : 2 à 24 caractères (lettres, chiffres, espace, _ - .).",
    PSEUDO_TAKEN: "Ce pseudo est déjà pris, essaie-en un autre.",
    AVATAR_INVALID: "Choisis un avatar dans la liste.",
    PROFILE_EXISTS: "Tu as déjà un profil.",
    PROFILE_UNAVAILABLE: "Le profil n'est pas disponible pour le moment. Réessaie dans un instant.",
    PODIUM_INVALID: "Choisis trois athlètes différents pour ton podium.",
    PREDICTION_LOCKED:
      "Trop tard : cette épreuve vient d'être verrouillée. Ton podium n'a pas été enregistré.",
    ATHLETE_NOT_IN_EVENT: "Cet athlète ne participe pas à cette épreuve.",
    JOKER_ALREADY_USED: "Tu as déjà utilisé ton joker dans cette compétition.",
    PREDICTION_UNAVAILABLE:
      "Ton prono n'est pas disponible pour le moment. Réessaie dans un instant.",
    retry: "Réessayer",
  },
} as const;
