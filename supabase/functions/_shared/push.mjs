// #203, #502: the sending of the push notifications due, shared by the Edge Function
// `push-notifications` (run every minute by pg_cron) and by `scripts/push-notifications.mjs`
// (by hand). Rules of what is due: the grouped reminders (#681),
// supabase/migrations/20261114060000_reminder_settings.sql, the Manager ones (#836),
// supabase/migrations/20261114070000_manager_reminders.sql, the reactions to a league moment
// (#672): supabase/migrations/20261115040000_moment_reactions.sql, the trash talk and the mercato
// reveal (#1093): supabase/migrations/20261122160000_trash_talk.sql, the trophies won (#1134):
// supabase/migrations/20261123110000_trophy_announcements.sql, and for the programme of a
// competition (#659): supabase/migrations/20261113120000_program_alerts.sql.
// Plain JavaScript with no import, so that Deno and Node both load it.
//
// Texts (#1093, « chambrage » tone for every family): a title of at most 35 characters starting
// with two emojis (the feeling, then the context), carrying the joke or the key fact; a body of at
// most 80 characters, the useful fact (time left, points, place, score) first, one emoji at its
// end, then the league name, never first. Three or four variants per case, picked from a hash of
// the player and what the notification is about, so that the same notification always reads the
// same. A name too long for the line (pseudo, league, athlete, event…) is shortened with « … ».

/** Most characters of a title and of a body, as the phone shows them (graphemes). */
export const TITLE_MAX = 35;
export const BODY_MAX = 80;

const segmenter = new Intl.Segmenter("fr", { granularity: "grapheme" });
/** @param {string} text */
const graphemes = (text) => Array.from(segmenter.segment(text), (s) => s.segment);
/** Length as the eye counts it: an emoji is one character. @param {string} text */
export const lengthOf = (text) => graphemes(text).length;

/** A name the line may shorten. @param {string | number} text */
const name = (text) => ({ name: String(text) });
/** Never shorter than this, « … » included. */
const NAME_MIN = 6;

/**
 * Joins the parts of a line; when it is too long, shortens its longest names first, ending them
 * with « … ».
 * @param {number} max
 * @param {(string | number | { name: string })[]} parts
 */
function fit(max, parts) {
  const names = parts.map((p) => (typeof p === "object" ? graphemes(p.name) : null));
  const sizes = names.map((n) => n?.length ?? 0);
  const fixed = parts.reduce(
    (n, p) => n + (typeof p === "object" ? 0 : lengthOf(String(p))),
    /** @type {number} */ (0),
  );
  let over = fixed + sizes.reduce((a, b) => a + b, 0) - max;
  while (over > 0) {
    const longest = sizes.indexOf(Math.max(...sizes.filter((_, i) => names[i])));
    if (longest < 0 || sizes[longest] <= NAME_MIN) break;
    sizes[longest] -= 1;
    over -= 1;
  }
  return parts
    .map((p, i) => {
      const n = names[i];
      if (!n) return String(p);
      return sizes[i] >= n.length ? n.join("") : `${n.slice(0, sizes[i] - 1).join("").trimEnd()}…`;
    })
    .join("");
}

/** @param {number} max */
const line =
  (max) =>
  /** @param {TemplateStringsArray} strings @param {(string | number | { name: string })[]} values */
  (strings, ...values) =>
    fit(
      max,
      strings.flatMap((s, i) => (i < values.length ? [s, /** @type {any} */ (values[i])] : [s])),
    );
const title = line(TITLE_MAX);
const body = line(BODY_MAX);

/** FNV-1a: the same text always gives the same number. @param {string} text */
function hashOf(text) {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= /** @type {number} */ (char.codePointAt(0));
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** @typedef {{ title: string, body: string }} Text */
/** @typedef {{ variants: Text[], url: string, tag: string }} Variants */

/** One variant, always the same for the same seed. @param {Variants} v @param {string} seed */
const pick = (v, seed) => ({
  ...v.variants[hashOf(seed) % v.variants.length],
  url: v.url,
  tag: v.tag,
});

/** @param {string} t @param {string} b @returns {Text} */
const text = (t, b) => ({ title: t, body: b });

const GENDER = { F: "F", M: "H", X: "mixte" };

/** « 100 m F », « 400 m haies H ». @param {{ discipline: string, gender: string }} event */
const labelOf = (event) =>
  `${event.discipline} ${GENDER[/** @type {"F" | "M" | "X"} */ (event.gender)] ?? ""}`.trim();

/** @param {number} n */
const pts = (n) => (n > 1 ? `${n} pts` : `${n} pt`);

/** « 1er », « 4e ». @param {number} rank */
const ordinal = (rank) => (rank === 1 ? "1er" : `${rank}e`);

/** « 45 min », « 2 h », « 1 h 30 ». @param {number} minutes */
const durationOf = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, "0")}` : ""}`;
};

/** Minutes left before an instant, at least 1. @param {string} iso @param {number} now */
const minutesUntil = (iso, now) => Math.max(1, Math.round((new Date(iso).getTime() - now) / 60_000));

/** « 1 autre », « 3 autres ». @param {number} n */
const others = (n) => `${n} ${n > 1 ? "autres" : "autre"}`;

/**
 * « Pronos oubliés » (#681): every final of the evening locking soon without the player's podium.
 * @param {{ events: { slug: string, discipline: string, gender: string, lock_at: string }[] }} p
 * @param {string} evening
 * @param {number} now
 * @returns {Variants}
 */
function forgottenOf(p, evening, now) {
  const [first] = p.events;
  const d = durationOf(minutesUntil(first.lock_at, now));
  const url = `/epreuves/${first.slug}`;
  const tag = `forgotten-${evening}`;
  if (p.events.length === 1) {
    const e = name(labelOf(first));
    return {
      url,
      tag,
      variants: [
        text(title`🚨⏱️ Verrou dans ${d} !`, body`Podium du ${e} vide. Les starters s'impatientent 🧦`),
        text(title`🔫😱 Faux départ en vue !`, body`Podium du ${e} vide. Verrou dans ${d} ⏳`),
        text(
          title`⏳🏃 Plus que ${d} pour ton prono`,
          body`${e} : les starters sont prêts, toi t'es au vestiaire 🧦`,
        ),
        text(title`📢🏟️ Dernier appel : ${d}`, body`${e} en chambre d'appel, ton podium est vide 🫣`),
      ],
    };
  }
  const n = p.events.length;
  const [a, b] = p.events.map((e) => name(labelOf(e)));
  const rest = n > 2 ? ` + ${others(n - 2)}` : "";
  return {
    url,
    tag,
    variants: [
      text(title`🚨🏃 ${n} podiums vides !`, body`${a}, ${b}${rest}. Premier verrou dans ${d} ⏳`),
      text(title`🔫😱 ${n} faux départs en vue !`, body`${a}, ${b}${rest}. Verrou dans ${d} ⏳`),
      text(
        title`⏳🏟️ Premier verrou dans ${d}`,
        body`${n} podiums vides : ${a}, ${b}${rest}. Fonce 🏃`,
      ),
      text(title`📢🚨 Chambre d'appel : ${n} podiums`, body`${a}, ${b}${rest}. Premier verrou dans ${d} 🧦`),
    ],
  };
}

/**
 * « Résultats du soir » (#681): the points of the evening and the place in the competition.
 * @param {{ points: number, finals: number, rank: number | null, players: number,
 *           competition_slug: string }} p
 * @param {string} evening
 * @returns {Variants}
 */
function recapOf(p, evening) {
  const url = `/mes-points?competition=${encodeURIComponent(p.competition_slug)}`;
  const tag = `recap-${evening}`;
  const plus = `+${pts(p.points)}`;
  const finals = p.finals > 1 ? `${p.finals} finales` : "1 finale";
  const placed = p.rank
    ? `${ordinal(p.rank)} sur ${p.players}, ${finals}.`
    : p.finals > 1
      ? `${finals} calculées.`
      : "Ta finale est calculée.";
  if (p.points > 0 && p.rank === 1)
    return {
      url,
      tag,
      variants: [
        text(title`👑🔥 ${plus}, t'es en tête !`, body`${placed} Tour d'honneur, drapeau sur les épaules 🇫🇷`),
        text(title`👑🏁 ${plus}, premier à la corde !`, body`${placed} Les autres regardent ton dos 😎`),
        text(title`🥇🔥 ${plus}, tête du classement !`, body`${placed} Tour d'honneur mérité 🏟️`),
        text(title`👑📸 ${plus}, photo-finish gagné !`, body`${placed} SB de la soirée, champion 🏆`),
      ],
    };
  if (p.points > 0)
    return {
      url,
      tag,
      variants: [
        text(title`📈💪 ${plus}, SB ce soir !`, body`${placed} Encore un effort pour le podium 🥉`),
        text(title`🔥🏃 ${plus} dans la musette`, body`${placed} Belle ligne droite ce soir 👏`),
        text(title`📈⏱️ ${plus}, le chrono progresse`, body`${placed} Le lièvre est devant, accroche-toi 🐇`),
        text(title`💪🎯 ${plus} ce soir !`, body`${placed} Pas encore un PB, mais ça avance 📈`),
      ],
    };
  return {
    url,
    tag,
    variants: [
      text(title`😬🥶 0 pt. Mordu à la planche`, body`${placed} Trois essais nuls, revanche demain 🔁`),
      text(title`🫠🔴 0 pt, soirée blanche`, body`${placed} Même le starter t'a oublié 🔁`),
      text(title`🙈🚫 0 pt. Faux départ général`, body`${placed} On remet les blocs demain 🔁`),
      text(title`🥶⛔ 0 pt. Barre tombée`, body`${placed} Ça arrive aux meilleurs, revanche demain 🔁`),
    ],
  };
}

/**
 * The end of a mercato round within 2 h (#836).
 * @param {any} p @param {string} tag @param {number} now @returns {Variants}
 */
function mercatoRoundOf(p, tag, now) {
  const d = durationOf(minutesUntil(p.ends_at, now));
  const l = name(p.league_name);
  return {
    url: `/manager/${p.league_id}/catalogue`,
    tag,
    variants: [
      text(title`🔨⏳ Mercato : plus que ${d}`, body`Tour ${p.round}. Dernière cloche avant le marteau 🔔 ${l}`),
      text(title`🔔🔨 Cloche du dernier tour : ${d}`, body`Tour ${p.round}. Pose tes dernières enchères 💸 ${l}`),
      text(title`⏳💸 ${d} pour tes enchères`, body`Tour ${p.round}. Après, coup de marteau 🔨 ${l}`),
      text(title`🔨🏃 Mercato : sprint final, ${d}`, body`Tour ${p.round}. Ne te fais pas souffler tes cibles 🎯 ${l}`),
    ],
  };
}

/**
 * A lineup not validated before the lock of a matchday (#836).
 * @param {any} p @param {string} tag @param {number} now @returns {Variants}
 */
function lineupOf(p, tag, now) {
  const d = durationOf(minutesUntil(p.lock_at, now));
  const c = name(p.competition_name);
  const l = name(p.league_name);
  return {
    url: `/manager/${p.league_id}/alignement/${encodeURIComponent(p.competition_slug)}`,
    tag,
    variants: [
      text(title`📋🚫 Pas aligné, verrou dans ${d}`, body`${c} : chambre d'appel, sinon DQ ❌ ${l}`),
      text(title`📋⏳ Aligne-toi, verrou dans ${d}`, body`${c} : sans alignement, 0 pt 🫥 ${l}`),
      text(title`🚨📋 Équipe pas alignée : ${d}`, body`${c} : tes athlètes poireautent ❌ ${l}`),
      text(title`📋🏟️ Verrou dans ${d}, aligne !`, body`${c} : pas aligné, pas de départ 🚫 ${l}`),
    ],
  };
}

/** A head-to-head won or lost by this much is a « raclée » (#1093): the winner has 1.5 times more. */
const ROUT_RATIO = 1.5;

/**
 * A head-to-head over (#836): a win, a defeat, a draw; a big gap is a « raclée » (#1093).
 * @param {any} p @param {string} tag @returns {Variants}
 */
function duelOverOf(p, tag) {
  const o = name(p.opponent);
  const l = name(p.league_name);
  const score = `${p.my_score}-${p.their_score}`;
  const j = `journée ${p.round}`;
  const high = Math.max(p.my_score, p.their_score);
  const low = Math.min(p.my_score, p.their_score);
  const rout = high > low && high >= Math.max(1, low) * ROUT_RATIO;
  /** @param {Text[]} variants @returns {Variants} */
  const out = (variants) => ({
    url: `/manager/${p.league_id}/confrontation/${p.round}/${p.home_id}`,
    tag,
    variants,
  });
  if (p.my_score > p.their_score && rout)
    return out([
      text(title`🧹😎 Raclée ${score}, ${j}`, body`T'as mis un tour à ${o} 💨 ${l}`),
      text(title`🚀🏆 Raclée ${score}, ${j}`, body`${o} ramasse encore ses pointes 👟 ${l}`),
      text(title`🧹🏆 Raclée ${score}, ${j}`, body`${o} t'a vu passer comme une fusée 🚀 ${l}`),
      text(title`😎💨 Raclée ${score}, ${j}`, body`${o} n'a même pas vu ton dossard 🏃 ${l}`),
    ]);
  if (p.my_score > p.their_score)
    return out([
      text(title`🏆🎉 Victoire ${score}, ${j}`, body`${o} cherche encore ses pointes 👟 ${l}`),
      text(title`🏆💪 Victoire ${score}, ${j}`, body`${o} a fini dans ton rétro 🪞 ${l}`),
      text(title`🥇🎉 Victoire ${score}, ${j}`, body`${o} voit ton dossard s'éloigner 🏃 ${l}`),
      text(title`🏆😎 Victoire ${score}, ${j}`, body`Tour d'honneur devant ${o} 🏟️ ${l}`),
    ]);
  if (p.my_score < p.their_score && rout)
    return out([
      text(title`🧹😵 Raclée ${score}, ${j}`, body`${o} t'a pris un tour. Rends tes pointes 👟 ${l}`),
      text(title`💥🧹 Raclée ${score}, ${j}`, body`${o} t'a laissé sur place 💨 ${l}`),
      text(title`🧹🥶 Raclée ${score}, ${j}`, body`${o} a fait le tour d'honneur 🏟️ ${l}`),
      text(title`😵💨 Raclée ${score}, ${j}`, body`${o} t'a pris deux tours 🐢 ${l}`),
    ]);
  if (p.my_score < p.their_score)
    return out([
      text(title`💥😵 Défaite ${score}, ${j}`, body`${o} t'a mis un tour dans la vue 💨 ${l}`),
      text(title`💥🏃 Défaite ${score}, ${j}`, body`${o} a eu le dernier mot 🔁 ${l}`),
      text(title`😤📸 Défaite ${score}, ${j}`, body`${o} a gagné au finish 📸 ${l}`),
      text(title`💥🥈 Défaite ${score}, ${j}`, body`${o} a mieux fini à la corde 🏃 ${l}`),
    ]);
  return out([
    text(title`🤝📸 Nul ${score}, ${j}`, body`${o} et toi, même le photo-finish hésite 🔁 ${l}`),
    text(title`🤝⏱️ Nul ${score}, ${j}`, body`${o} et toi, même chrono au millième ⏱️ ${l}`),
    text(title`🤝🔁 Nul ${score}, ${j}`, body`Revanche avec ${o} ? 🔁 ${l}`),
    text(title`📸🤝 Nul ${score}, ${j}`, body`${o} et toi, épaule contre épaule 🤝 ${l}`),
  ]);
}

/**
 * The reveal of a mercato round (#1093), to every participant: how many of the athletes they bid
 * on they got, who took one from them, or the end of the mercato.
 * @param {{ league_id: string, league_name: string, round: number, won: number, bids: number,
 *           last: boolean, lost?: { pseudo: string, athlete: string, diff: number } | null }} p
 * @param {string} tag
 * @returns {Variants}
 */
function mercatoRevealOf(p, tag) {
  const l = name(p.league_name);
  const r = p.round;
  const tally = `${p.won} sur ${p.bids}`;
  /** @param {Text[]} variants @returns {Variants} */
  const out = (variants) => ({ url: `/manager/${p.league_id}/tour/${r}`, tag, variants });
  const lost = p.lost;
  const stolen = lost
    ? lost.diff > 0
      ? [
          body`${name(lost.pseudo)} t'a soufflé ${name(lost.athlete)} pour +${lost.diff} cr. 💸 ${l}`,
          body`${name(lost.athlete)} part chez ${name(lost.pseudo)} (+${lost.diff} cr.). Radin 😤 ${l}`,
          body`${name(lost.pseudo)} t'a piqué ${name(lost.athlete)} pour +${lost.diff} cr. 🏃 ${l}`,
        ]
      : [
          body`${name(lost.pseudo)} t'a soufflé ${name(lost.athlete)} au chrono ⏱️ ${l}`,
          body`${name(lost.athlete)} part chez ${name(lost.pseudo)}, plus rapide 📸 ${l}`,
          body`${name(lost.pseudo)} t'a piqué ${name(lost.athlete)} au photo-finish 📸 ${l}`,
        ]
    : [];
  if (p.last)
    return out([
      text(title`🔨🏁 Mercato terminé !`, body`${p.bids ? `${tally} au dernier tour. ` : ""}Place aux alignements 📋 ${l}`),
      text(title`🏁📋 Mercato bouclé !`, body`${p.bids ? `${tally} au dernier tour. ` : ""}Ton équipe est prête 🏃 ${l}`),
      text(title`🔨🎬 Rideau sur le mercato !`, body`${p.bids ? `${tally} au dernier tour. ` : ""}Va aligner ton équipe 📋 ${l}`),
    ]);
  if (!p.bids)
    return out([
      text(title`🔨👀 Tour ${r} révélé`, body`Vu des tribunes : va voir qui a pris qui 🍿 ${l}`),
      text(title`🔨🍿 Tour ${r} révélé`, body`Zéro enchère. Va voir qui a pris qui 👀 ${l}`),
      text(title`👀🏟️ Tour ${r} révélé`, body`T'as regardé la course des tribunes 🍿 ${l}`),
    ]);
  if (p.won === p.bids)
    return out([
      text(title`🔨🤑 Mercato : ${tally} !`, body`Tour ${r} bouclé. T'as tout raflé, carton plein 🎯 ${l}`),
      text(title`🔨🎯 Mercato : ${tally}, carton !`, body`Tour ${r} : aucune enchère soufflée 😎 ${l}`),
      text(title`🔨🏆 Mercato : ${tally} !`, body`Tour ${r} : t'as tout raflé, PB de l'enchère 🤑 ${l}`),
    ]);
  if (p.won === 0)
    return out([
      text(title`🔨😭 Mercato : ${tally}`, body`Tour ${r} : tout le monde t'est passé devant 💸 ${l}`),
      text(title`🔨🥶 Mercato : ${tally}`, body`Tour ${r} : sors le chéquier au prochain 💸 ${l}`),
      ...(stolen.length ? [] : [text(title`🔨🫠 Mercato : ${tally}`, body`Tour ${r} : t'as lâché le témoin 🏃 ${l}`)]),
      ...stolen.slice(0, 2).map((b) => text(title`🔨😭 Mercato : ${tally}`, b)),
    ]);
  return out(
    stolen.length
      ? stolen.map((b, i) => text(i === 1 ? title`🔨😤 Mercato : ${tally}` : title`🔨😏 Mercato : ${tally}`, b))
      : [
          text(title`🔨😏 Mercato : ${tally}`, body`Tour ${r} : des athlètes partis ailleurs 💸 ${l}`),
          text(title`🔨😤 Mercato : ${tally}`, body`Tour ${r} : t'as lâché le témoin en route 🏃 ${l}`),
          text(title`🔨📸 Mercato : ${tally}`, body`Tour ${r} : quelques photo-finish perdus 📸 ${l}`),
        ],
  );
}

/**
 * The trash talk of an evening (#1093), in one league where the player has an opponent: overtaken
 * by a member, overtaking one, last with 0 pt, the only one to miss or to find the winner of a final.
 * @param {{ trigger: string, league_id: string, league_name: string, rank: number,
 *           players: number, other?: string, event?: { slug: string, discipline: string,
 *           gender: string } }} p
 * @param {string} evening
 * @returns {Variants}
 */
function trashTalkOf(p, evening) {
  const l = name(p.league_name);
  const o = name(p.other ?? "");
  const r = `${ordinal(p.rank)} sur ${p.players}`;
  const e = p.event ? name(labelOf(p.event)) : name("");
  /** @param {Text[]} variants @returns {Variants} */
  const out = (variants) => ({ url: `/ligues/${p.league_id}`, tag: `trash_talk-${evening}`, variants });
  if (p.trigger === "overtaken")
    return out([
      text(title`🏃💨 ${o} t'a doublé !`, body`Te voilà ${r}. Tu dormais à la corde ? 😴 ${l}`),
      text(title`😱🏁 ${o} t'a doublé !`, body`${r} désormais. Pris dans la ligne droite 🫢 ${l}`),
      text(title`🏃💨 Doublé par ${o} !`, body`${r} désormais. Il reste des tours, relance 🔁 ${l}`),
      text(title`👀🏃 ${o} te passe devant`, body`${r} désormais. T'as raté la cloche ? 🔔 ${l}`),
    ]);
  if (p.trigger === "overtook")
    return out([
      text(title`😎🏁 T'as doublé ${o} !`, body`${r} désormais. Petit coucou dans le rétro 👋 ${l}`),
      text(title`🚀😏 ${o} dans ton rétro !`, body`${r} désormais. Doublé à la corde, propre 🏁 ${l}`),
      text(title`💨😎 T'as doublé ${o} !`, body`${r} désormais. Belle accélération finale 🚀 ${l}`),
      text(title`😏🏃 ${o} est derrière toi`, body`${r} désormais. Fais coucou dans le rétro 👋 ${l}`),
    ]);
  if (p.trigger === "last")
    return out([
      text(title`🐢🔴 Lanterne rouge`, body`${r}, 0 pt. Même le lièvre t'attend à l'arrivée 🐇 ${l}`),
      text(title`🐢🔴 Lanterne rouge ce soir`, body`${r}, 0 pt. Va falloir un PB demain 📈 ${l}`),
      text(title`🔴🥶 0 pt, lanterne rouge`, body`${r}. Les autres ont tous marqué 🙈 ${l}`),
      text(title`🐌🔴 Lanterne rouge !`, body`${r}, 0 pt. La voiture-balai t'attend 🧹 ${l}`),
    ]);
  if (p.trigger === "lone_miss")
    return out([
      text(title`🙈🎯 T'es le seul à l'avoir raté`, body`${e} : tous l'avaient, sauf toi 🤡 ${l}`),
      text(title`🙈🎯 Seul à rater le vainqueur`, body`${e} : toi, couloir 9 🤡 ${l}`),
      text(title`🤡🎯 Tout le monde l'avait…`, body`…sauf toi : ${e}, vainqueur raté 🙈 ${l}`),
      text(title`🙈🔫 Faux départ en solo`, body`${e} : seul à rater l'or 🤡 ${l}`),
    ]);
  return out([
    text(title`🧠🔮 Seul à l'avoir vu venir !`, body`${e} : seul à avoir trouvé l'or 😏 ${l}`),
    text(title`🔮😏 Seul contre tous, et raison`, body`${e} : vainqueur trouvé 🧠 ${l}`),
    text(title`🧠🎯 Coup de flair en solo !`, body`${e} : les autres cherchent encore 😏 ${l}`),
    text(title`🔮🏁 Tu l'avais vu venir !`, body`${e} : seul à avoir l'or 🤓 ${l}`),
  ]);
}

/**
 * The reactions to my league moments (#672), grouped: one an hour at most.
 * @param {{ count: number, pseudo: string, league_id: string, league_name: string }} p
 * @returns {Variants}
 */
function momentReactionOf(p) {
  const l = name(p.league_name);
  /** @param {string} emojis */
  const head = (emojis) =>
    p.count > 1
      ? title`${emojis} ${name(p.pseudo)} +${p.count - 1} ont réagi`
      : title`${emojis} ${name(p.pseudo)} a réagi`;
  return {
    url: `/ligues/${p.league_id}?onglet=fil`,
    tag: "moment_reaction",
    variants: [
      text(head("💬👀"), body`Ton moment met le feu aux tribunes 📣 ${l}`),
      text(head("📣💬"), body`Les tribunes s'enflamment pour ton moment 🔥 ${l}`),
      text(head("👀🏟️"), body`Va voir ce qu'ils disent de ton moment 👀 ${l}`),
      text(head("🔥💬"), body`Ton moment fait parler dans les gradins 📣 ${l}`),
    ],
  };
}

/** The animals of the statuettes, their emoji, and the metals (#1134), as on the profile. */
const ANIMALS = {
  lievre: ["Lièvre", "🐇"],
  guepard: ["Guépard", "🐆"],
  impala: ["Impala", "🦌"],
  kangourou: ["Kangourou", "🦘"],
  chat: ["Chat", "🐈"],
  ours: ["Ours", "🐻"],
  renard: ["Renard", "🦊"],
};
const METALS = { gold: "d'or", silver: "d'argent", bronze: "de bronze" };
const MEDALS = { gold: "🥇", silver: "🥈", bronze: "🥉" };

/**
 * A trophy just won (#1134), to its winner: a final podium (predictions or Manager league), a
 * Chrono figé, a Record de ligue, the laurel of the general ranking or the Témoin d'or. The league
 * comes last; the general ranking and the Témoin d'or have none.
 * @param {{ trophy: string, metal: "gold" | "silver" | "bronze" | null, animal: string | null,
 *           season: number, league_name: string | null, points: number | null }} p
 * @param {string} tag
 * @returns {Variants}
 */
function trophyOf(p, tag) {
  const l = name(p.league_name ?? "");
  const metal = p.metal ?? "gold";
  const m = MEDALS[metal];
  /** @param {Text[]} variants @returns {Variants} */
  const out = (variants) => ({ url: "/profil", tag, variants });
  if (p.trophy === "league" || p.trophy === "manager") {
    const key = /** @type {keyof typeof ANIMALS} */ (p.trophy === "league" ? p.animal : "lievre");
    const [animal, emoji] = ANIMALS[key] ?? ANIMALS.lievre;
    const statuette = `${animal} ${METALS[metal]}`;
    const place = metal === "gold" ? "1er" : metal === "silver" ? "2e" : "3e";
    const game = p.trophy === "manager" ? "de la saison Manager" : "au classement final";
    return out([
      text(title`🏆${emoji} ${statuette} !`, body`${place} ${game}, sur le podium ${m} ${l}`),
      text(title`${m}${emoji} ${statuette} pour toi !`, body`${place} ${game}. Ta statuette t'attend 🏆 ${l}`),
      text(title`🏆🎉 ${statuette} !`, body`${place} ${game}. Tour d'honneur 🏟️ ${l}`),
    ]);
  }
  if (p.trophy === "chrono") {
    const feat = p.points != null ? `${pts(p.points)} en une soirée` : "Ta meilleure soirée";
    return out([
      text(title`⏱️🔥 Chrono figé !`, body`${feat}, personne n'a fait mieux 🔥 ${l}`),
      text(title`⏱️😎 Chrono figé pour toi !`, body`${feat} : la meilleure de la saison ⏱️ ${l}`),
      text(title`🔥⏱️ Soirée de feu !`, body`${feat}, le chrono est figé 🧊 ${l}`),
    ]);
  }
  if (p.trophy === "record") {
    const feat = p.points != null ? `${pts(p.points)} sur une compétition` : "Record de la ligue";
    return out([
      text(title`📜🔥 Record de ligue !`, body`${feat}, record battu 📜 ${l}`),
      text(title`📜😎 Record battu !`, body`${feat} : ton nom est gravé 🪧 ${l}`),
      text(title`🏆📜 Nouveau record !`, body`${feat}, personne n'a fait mieux 💪 ${l}`),
    ]);
  }
  if (p.trophy === "general") {
    const place = metal === "gold" ? "1er" : metal === "silver" ? "Top 3" : "Top 10";
    return out([
      text(title`🌿👑 ${place} de la saison !`, body`Laurier ${METALS[metal]} du classement général ${p.season} ${m}`),
      text(title`🌿${m} Laurier ${METALS[metal]} !`, body`${place} du classement général ${p.season} 👑`),
      text(title`👑🎉 Saison ${p.season} bouclée !`, body`${place} du général : un laurier ${METALS[metal]} pour toi 🌿`),
    ]);
  }
  return out([
    text(title`🥇🎙️ Témoin d'or !`, body`Tu as fini une compétition devant FrenchTrack 😎`),
    text(title`🎙️😎 Témoin d'or pour toi !`, body`FrenchTrack t'a vu passer devant, bien joué 🏃`),
    text(title`🥇🏃 FrenchTrack battu !`, body`Témoin d'or ${p.season} : devant le compte FrenchTrack 😎`),
  ]);
}

/** Reminders worth nothing once their time is over: a short lifetime on the push service. */
const SHORT_LIVED = ["forgotten", "mercato_round", "lineup"];

/**
 * Every variant of a notification due, with its link and tag.
 * @param {{ kind: string, evening: string, ref?: string, payload: any }} due
 * @param {number} [now]
 * @returns {Variants}
 */
export function notificationVariants(due, now = Date.now()) {
  const tag = `${due.kind}-${due.ref ?? ""}`;
  const p = due.payload;
  switch (due.kind) {
    case "moment_reaction":
      return momentReactionOf(p);
    case "mercato_round":
      return mercatoRoundOf(p, tag, now);
    case "lineup":
      return lineupOf(p, tag, now);
    case "duel_over":
      return duelOverOf(p, tag);
    case "mercato_reveal":
      return mercatoRevealOf(p, tag);
    case "trash_talk":
      return trashTalkOf(p, due.evening);
    case "trophy":
      return trophyOf(p, tag);
    case "forgotten":
      return forgottenOf(p, due.evening, now);
    default:
      return recapOf(p, due.evening);
  }
}

/**
 * The text of a notification due: « Pronos oubliés », « Résultats du soir » (#681), a Manager one
 * (#836), the reactions to my moments (#672), the trash talk or the mercato reveal (#1093), a
 * trophy won (#1134). One
 * variant, always the same for the same player and the same thing.
 * @param {{ user_id?: string, kind: string, evening: string, ref?: string, payload: any }} due
 * @param {number} [now]
 */
export function notificationOf(due, now = Date.now()) {
  return pick(
    notificationVariants(due, now),
    `${due.user_id ?? ""}|${due.kind}|${due.evening}|${due.ref ?? ""}`,
  );
}

/**
 * Every variant of the notification sent when the programme of a competition is published (#659).
 * @param {{ competition_slug: string, competition_name: string }} due
 * @returns {Variants}
 */
export function programVariants(due) {
  const c = name(due.competition_name);
  return {
    url: `/competitions?competition=${encodeURIComponent(due.competition_slug)}`,
    tag: `program-${due.competition_slug}`,
    variants: [
      text(title`📣🏟️ Le programme est là !`, body`${c} : les finales sont là, à toi de poser tes podiums 🎯`),
      text(title`🔫🏟️ Le starter a parlé !`, body`Programme de ${c} en ligne. Pose tes podiums 🎯`),
      text(title`📣📅 Programme en ligne !`, body`${c} : chambre d'appel ouverte pour tes podiums 🎯`),
    ],
  };
}

/**
 * The text of the notification sent when the programme of a competition is published (#659).
 * @param {{ user_id?: string, competition_slug: string, competition_name: string }} due
 */
export function programNotificationOf(due) {
  return pick(programVariants(due), `${due.user_id ?? ""}|program|${due.competition_slug}`);
}


/**
 * Sends one notification to one device: "sent"; "gone" when the device unsubscribed (404, 410);
 * otherwise the failed HTTP status, or "network", logged.
 * @param {(device: any, payload: string, options: any) => Promise<unknown>} push
 * @param {{ endpoint: string, p256dh: string, auth: string }} device
 * @param {string} payload
 * @param {number} ttl in seconds
 * @returns {Promise<"sent" | "gone" | number | "network">}
 */
async function sendOne(push, device, payload, ttl) {
  try {
    await push(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      payload,
      { TTL: ttl, urgency: "high" },
    );
    return "sent";
  } catch (error) {
    const { statusCode, body } = /** @type {{ statusCode?: number, body?: string }} */ (error);
    if (statusCode === 404 || statusCode === 410) return "gone";
    console.error(`push failed (${statusCode ?? "network"}): ${body ?? error}`);
    return statusCode ?? "network";
  }
}

/**
 * Sends what is due to every device of each player, then records it.
 * `push(device, payload, options)` sends one notification (web-push's sendNotification); it throws
 * an error with `statusCode` 404 or 410 when the device unsubscribed.
 * Then the same for the programmes published (#659), one notification per player and competition.
 * @param {{ due: () => Promise<any[]>, markSent: (sent: any[]) => Promise<void>,
 *           programDue: () => Promise<any[]>, markProgramSent: (sent: any[]) => Promise<void>,
 *           forget: (endpoints: string[]) => Promise<void> }} database
 * @param {(device: any, payload: string, options: any) => Promise<unknown>} push
 */
export async function sendDue(database, push) {
  const due = await database.due();
  const programs = await database.programDue();
  /** @type {string[]} */
  const forgotten = [];
  /** Failed sends by kind and HTTP status (#527), in the order first met. */
  /** @type {Map<string, { kind: string, status: number | "network", count: number }>} */
  const failures = new Map();
  let failed = 0;

  /**
   * @param {string} kind
   * @param {any[]} devices
   * @param {string} payload
   * @param {number} ttl in seconds
   */
  async function sendToDevices(kind, devices, payload, ttl) {
    for (const device of devices) {
      const status = await sendOne(push, device, payload, ttl);
      if (status === "sent") continue;
      if (status === "gone") {
        forgotten.push(device.endpoint);
        continue;
      }
      failed += 1;
      const key = `${kind}:${status}`;
      const failure = failures.get(key) ?? { kind, status, count: 0 };
      failure.count += 1;
      failures.set(key, failure);
    }
  }

  for (const notification of due) {
    await sendToDevices(
      notification.kind,
      notification.devices,
      JSON.stringify(notificationOf(notification)),
      SHORT_LIVED.includes(notification.kind) ? 15 * 60 : 24 * 3600,
    );
  }
  for (const program of programs) {
    await sendToDevices(
      "program",
      program.devices,
      JSON.stringify(programNotificationOf(program)),
      24 * 3600,
    );
  }
  if (due.length)
    await database.markSent(
      due.map(({ user_id, kind, evening, ref }) => ({ user_id, kind, evening, ref: ref ?? "" })),
    );
  if (programs.length)
    await database.markProgramSent(
      programs.map(({ user_id, competition_slug }) => ({ user_id, competition_slug })),
    );
  if (forgotten.length) await database.forget(forgotten);
  return {
    sent: due.length + programs.length,
    forgotten: forgotten.length,
    failed,
    failures: [...failures.values()],
  };
}

/**
 * One example of every notification, with invented data (#1016), each with its own tag so that
 * they do not replace one another on the phone.
 * @param {number} now
 */
export function testNotifications(now = Date.now()) {
  const inMinutes = (/** @type {number} */ m) => new Date(now + m * 60_000).toISOString();
  const league = { league_id: "demo", league_name: "Les Lièvres" };
  const duel = { ...league, round: 3, home_id: "demo", opponent: "Gazelle" };
  const events = [
    { slug: "100m-f", discipline: "100 m", gender: "F", lock_at: inMinutes(45) },
    { slug: "400mh-h", discipline: "400 m haies", gender: "M", lock_at: inMinutes(90) },
    { slug: "perche-f", discipline: "Perche", gender: "F", lock_at: inMinutes(120) },
  ];
  const recap = { finals: 3, players: 18, competition_slug: "demo" };
  const final = { slug: "800m-h", discipline: "800 m", gender: "M" };
  const trashTalk = [
    { trigger: "overtaken", other: "Gazelle", rank: 4, players: 8 },
    { trigger: "overtook", other: "Gazelle", rank: 3, players: 8 },
    { trigger: "last", rank: 8, players: 8 },
    { trigger: "lone_miss", event: final, rank: 5, players: 8 },
    { trigger: "lone_find", event: final, rank: 2, players: 8 },
  ];
  const manager = (/** @type {string} */ kind, /** @type {any} */ payload) =>
    notificationOf({ kind, evening: "demo", ref: kind, payload }, now);
  const samples = [
    notificationOf({ kind: "forgotten", evening: "a", payload: { events: events.slice(0, 1) } }, now),
    notificationOf({ kind: "forgotten", evening: "b", payload: { events } }, now),
    notificationOf({ kind: "recap", evening: "c", payload: { ...recap, points: 12, rank: 1 } }),
    notificationOf({ kind: "recap", evening: "d", payload: { ...recap, points: 12, rank: 4 } }),
    notificationOf({ kind: "recap", evening: "e", payload: { ...recap, points: 0, rank: 12 } }),
    manager("mercato_round", { ...league, round: 2, ends_at: inMinutes(120) }),
    manager("lineup", {
      ...league,
      competition_slug: "demo",
      competition_name: "Meeting de démo",
      lock_at: inMinutes(60),
    }),
    manager("duel_over", { ...duel, my_score: 42, their_score: 38 }),
    manager("duel_over", { ...duel, my_score: 38, their_score: 42 }),
    manager("duel_over", { ...duel, my_score: 40, their_score: 40 }),
    manager("duel_over", { ...duel, my_score: 18, their_score: 52 }),
    manager("mercato_reveal", { ...league, round: 2, won: 3, bids: 3, last: false, lost: null }),
    manager("mercato_reveal", {
      ...league,
      round: 3,
      won: 2,
      bids: 4,
      last: false,
      lost: { pseudo: "Gazelle", athlete: "Athlète Démo", diff: 3 },
    }),
    manager("mercato_reveal", { ...league, round: 2, won: 0, bids: 3, last: false, lost: null }),
    manager("mercato_reveal", { ...league, round: 2, won: 0, bids: 0, last: false, lost: null }),
    manager("mercato_reveal", { ...league, round: 3, won: 1, bids: 2, last: true, lost: null }),
    ...trashTalk.map((payload) =>
      notificationOf({ kind: "trash_talk", evening: "demo", payload: { ...league, ...payload } }),
    ),
    notificationOf({
      kind: "moment_reaction",
      evening: "f",
      payload: { ...league, count: 3, pseudo: "Gazelle" },
    }),
    manager("trophy", {
      ...league,
      trophy: "league",
      metal: "gold",
      animal: "guepard",
      season: 2026,
      points: null,
    }),
    manager("trophy", { ...league, trophy: "chrono", metal: null, animal: null, season: 2026, points: 84 }),
    programNotificationOf({ competition_slug: "demo", competition_name: "Meeting de démo" }),
  ];
  return [
    ...samples.map((sample, index) => ({ ...sample, tag: `test-${index + 1}` })),
    {
      title: "🔔✅ Test réussi",
      body: "Les notifications French Track Prono marchent sur cet appareil 📱",
      url: "/",
      tag: "test",
    },
  ];
}

/**
 * Sends one example of every notification to the given devices of an account (#977, #1016), to
 * check that push notifications reach a phone, and how they look, without waiting for a reminder
 * or a result. A device counts as sent when it got them all.
 * @param {{ endpoint: string, p256dh: string, auth: string }[]} devices
 * @param {(device: any, payload: string, options: any) => Promise<unknown>} push
 */
export async function sendTest(devices, push) {
  const payloads = testNotifications().map((notification) => JSON.stringify(notification));
  /** @type {string[]} */
  const forgotten = [];
  let sent = 0;
  let failed = 0;
  for (const device of devices) {
    let outcome = "sent";
    for (const payload of payloads) {
      const status = await sendOne(push, device, payload, 15 * 60);
      if (status !== "sent") {
        outcome = status === "gone" ? "gone" : "failed";
        break;
      }
    }
    if (outcome === "sent") sent += 1;
    else if (outcome === "gone") forgotten.push(device.endpoint);
    else failed += 1;
  }
  return { sent, forgotten, failed };
}
