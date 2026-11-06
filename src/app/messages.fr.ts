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
  errors: {
    EVENTS_UNAVAILABLE: "Impossible de charger les épreuves pour le moment.",
    EVENT_NOT_FOUND: "Cette épreuve n'existe pas.",
    retry: "Réessayer",
  },
} as const;
