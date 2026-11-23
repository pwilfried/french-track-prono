import { describe, expect, it } from "vitest";

import {
  BODY_MAX,
  TITLE_MAX,
  lengthOf,
  notificationOf,
  notificationVariants,
  programVariants,
} from "./push.mjs";

// #1093: every notification in the « chambrage » tone, with the rules of the issue.
const now = new Date("2026-11-11T18:00:00Z").getTime();
const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const segmenter = new Intl.Segmenter("fr", { granularity: "grapheme" });
const graphemes = (text: string) => Array.from(segmenter.segment(text), (s) => s.segment);
const isEmoji = (g: string) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);

type Due = { user_id?: string; kind: string; evening: string; ref?: string; payload: unknown };

/** The worst case of the issue: a pseudo of 20 characters, a league of 30, long names. */
const PSEUDO = "Gazelle des Plateaux";
const LEAGUE = "Les Lièvres du Mercredi Soir !";
const league = { league_id: "l1", league_name: LEAGUE };
const final = (slug: string, discipline: string, gender: string, minutes: number) => ({
  slug,
  discipline,
  gender,
  lock_at: at(minutes),
});
const longFinals = [
  final("3000m-steeple-f", "3000 m steeple", "F", 45),
  final("4x400m-x", "4 × 400 m relais", "X", 90),
  final("longueur-m", "Saut en longueur", "M", 95),
  final("perche-f", "Saut à la perche", "F", 100),
];
const finalOf = { slug: "3000m-steeple-f", discipline: "3000 m steeple", gender: "F" };
const duel = { ...league, round: 12, home_id: "u9", opponent: PSEUDO };
const reveal = { ...league, round: 3, won: 2, bids: 4, last: false, lost: null };
const stolen = { pseudo: PSEUDO, athlete: "Femke Bol-Van der Westhuizen", diff: 125 };

const WORST: Due[] = [
  { kind: "forgotten", evening: "e", payload: { events: longFinals.slice(0, 1) } },
  { kind: "forgotten", evening: "e", payload: { events: longFinals.slice(0, 2) } },
  { kind: "forgotten", evening: "e", payload: { events: longFinals } },
  ...[
    { points: 128, rank: 1 },
    { points: 128, rank: 104 },
    { points: 0, rank: 1204 },
    { points: 3, rank: null },
  ].map((p) => ({
    kind: "recap",
    evening: "e",
    payload: { ...p, finals: 12, players: 1250, competition_slug: "meeting" },
  })),
  {
    kind: "recap",
    evening: "e",
    payload: { points: 0, rank: null, finals: 1, players: 0, competition_slug: "m" },
  },
  { kind: "mercato_round", evening: "e", ref: "r", payload: { ...league, round: 12, ends_at: at(90) } },
  {
    kind: "lineup",
    evening: "e",
    ref: "r",
    payload: {
      ...league,
      competition_slug: "c",
      competition_name: "Championnats d'Europe en salle 2027",
      lock_at: at(150),
    },
  },
  ...[
    [2310, 1980],
    [5200, 1800],
    [1980, 2310],
    [1800, 5200],
    [1980, 1980],
    [0, 0],
  ].map(([my, their]) => ({
    kind: "duel_over",
    evening: "e",
    ref: "r",
    payload: { ...duel, my_score: my, their_score: their },
  })),
  ...[
    reveal,
    { ...reveal, won: 4 },
    { ...reveal, won: 0 },
    { ...reveal, won: 0, lost: stolen },
    { ...reveal, lost: stolen },
    { ...reveal, lost: { ...stolen, diff: 0 } },
    { ...reveal, bids: 0, won: 0 },
    { ...reveal, last: true },
    { ...reveal, last: true, bids: 0, won: 0 },
  ].map((payload) => ({ kind: "mercato_reveal", evening: "e", ref: "r", payload })),
  ...[
    { trigger: "overtaken", other: PSEUDO },
    { trigger: "overtook", other: PSEUDO },
    { trigger: "last" },
    { trigger: "lone_miss", event: finalOf },
    { trigger: "lone_find", event: finalOf },
  ].map((p) => ({
    kind: "trash_talk",
    evening: "e",
    payload: { ...league, ...p, rank: 49, players: 50 },
  })),
  ...[1, 2, 15].map((count) => ({
    kind: "moment_reaction",
    evening: "e",
    payload: { ...league, count, pseudo: PSEUDO },
  })),
  // #1134: every trophy, in every metal, with the longest statuette and points.
  ...[
    ...(["gold", "silver", "bronze"] as const).flatMap((metal) => [
      { trophy: "league", metal, animal: "kangourou" },
      { trophy: "manager", metal, animal: "lievre" },
      { trophy: "general", metal, animal: null, league_id: null, league_name: null },
    ]),
    { trophy: "chrono", metal: null, animal: null, points: 1284 },
    { trophy: "chrono", metal: null, animal: null, points: null },
    { trophy: "record", metal: null, animal: null, points: 2312 },
    { trophy: "record", metal: null, animal: null, points: null },
    { trophy: "witness", metal: null, animal: null, league_id: null, league_name: null },
  ].map((p) => ({
    kind: "trophy",
    evening: "e",
    ref: "n1",
    payload: { ...league, season: 2026, points: null, ...p },
  })),
];

const allVariants = () => [
  ...WORST.map((due) => notificationVariants(due, now).variants),
  programVariants({ competition_slug: "c", competition_name: "Championnats d'Europe en salle 2027" })
    .variants,
];

describe("notification texts (#1093)", () => {
  it("keeps every variant within 35 characters for the title and 80 for the body", () => {
    for (const { title, body } of allVariants().flat()) {
      expect(lengthOf(title), title).toBeLessThanOrEqual(TITLE_MAX);
      expect(lengthOf(body), body).toBeLessThanOrEqual(BODY_MAX);
    }
  });

  it("starts every title with two emojis and ends every body with an emoji, then the league", () => {
    for (const { title, body } of allVariants().flat()) {
      const [first, second, space] = graphemes(title);
      expect(isEmoji(first!) && isEmoji(second!) && space === " ", title).toBe(true);
      const chars = graphemes(body);
      const last = chars.findLastIndex(isEmoji);
      const after = chars.slice(last + 1).join("").trim();
      // The league comes last, maybe shortened; nothing else after the emoji.
      expect(after === "" || LEAGUE.startsWith(after.replace(/…$/, "")), body).toBe(true);
    }
  });

  it("offers three or four variants per case", () => {
    for (const variants of allVariants()) {
      expect(variants.length).toBeGreaterThanOrEqual(3);
      expect(variants.length).toBeLessThanOrEqual(4);
    }
  });

  it("picks the same variant for the same player and evening, and uses them all across players", () => {
    const due = { ...WORST[3]!, user_id: "u1" };
    expect(notificationOf(due, now)).toEqual(notificationOf(due, now));
    const titles = new Set(
      Array.from({ length: 200 }, (_, i) => notificationOf({ ...due, user_id: `u${i}` }, now).title),
    );
    expect(titles.size).toBe(notificationVariants(due, now).variants.length);
  });

  it("shortens a name too long for the line with an ellipsis, and only then", () => {
    const short = { ...league, league_name: "Les Lièvres" };
    const due = { kind: "mercato_round", evening: "e", ref: "r", payload: { ...short, round: 2, ends_at: at(90) } };
    for (const { body } of notificationVariants(due, now).variants) expect(body).toMatch(/Les Lièvres$/);
    const long = { ...due, payload: { ...due.payload, league_name: "L".repeat(60) } };
    for (const { body } of notificationVariants(long, now).variants) {
      expect(body).toMatch(/L…$/);
      expect(lengthOf(body)).toBeLessThanOrEqual(BODY_MAX);
    }
  });
});

/** Every variant of a due notification, title and body together. */
const texts = (due: Due) =>
  notificationVariants(due, now).variants.map((v: { title: string; body: string }) => `${v.title} | ${v.body}`);

describe("what each notification says (#1093)", () => {
  it("tells the forgotten final and the time left before its lock", () => {
    const due = { kind: "forgotten", evening: "2026-11-11", payload: { events: [final("100m-f", "100 m", "F", 10)] } };
    expect(notificationOf(due, now)).toMatchObject({ url: "/epreuves/100m-f", tag: "forgotten-2026-11-11" });
    for (const t of texts(due)) expect(t).toContain("10 min");
    for (const t of texts(due)) expect(t).toContain("100 m F");
  });

  it("lists two forgotten finals, and « + n autres » beyond", () => {
    const two = { kind: "forgotten", evening: "e", payload: { events: longFinals.slice(0, 2).map((e) => ({ ...e, discipline: "100 m" })) } };
    for (const t of texts(two)) expect(t).toMatch(/100 m F, 100 m mixte\. /);
    const four = { kind: "forgotten", evening: "e", payload: { events: [final("a", "100 m", "F", 45), final("b", "400 m", "M", 50), ...longFinals.slice(2)] } };
    for (const t of texts(four)) {
      expect(t).toContain("100 m F, 400 m H + 2 autres");
      expect(t).toContain("45 min");
      expect(t).toContain("4");
    }
  });

  it("tells the points, the place and the finals of the evening", () => {
    const recap = (p: object) => ({
      kind: "recap",
      evening: "2026-11-11",
      payload: { points: 9, finals: 2, rank: 4, players: 120, competition_slug: "meeting-paris", ...p },
    });
    expect(notificationOf(recap({}))).toMatchObject({ url: "/mes-points?competition=meeting-paris", tag: "recap-2026-11-11" });
    for (const t of texts(recap({}))) expect(t).toMatch(/\+9 pts.*\| 4e sur 120, 2 finales\. /);
    for (const t of texts(recap({ points: 12, rank: 1 }))) expect(t).toMatch(/\+12 pts.*\| 1er sur 120/);
    for (const t of texts(recap({ points: 1 }))) expect(t).toContain("+1 pt");
    for (const t of texts(recap({ points: 0, rank: 1 }))) expect(t).toMatch(/0 pt.*\| 1er sur 120/);
    for (const t of texts(recap({ finals: 1, rank: null }))) expect(t).toContain("| Ta finale est calculée.");
  });

  it("tells the end of a mercato round in hours and minutes, with its league", () => {
    const due = { kind: "mercato_round", evening: "e", ref: "l1:2", payload: { ...league, league_name: "Les Lièvres", round: 2, ends_at: at(90) } };
    expect(notificationOf(due, now)).toMatchObject({ url: "/manager/l1/catalogue", tag: "mercato_round-l1:2" });
    for (const t of texts(due)) expect(t).toMatch(/1 h 30.*Tour 2.*Les Lièvres$/);
  });

  it("tells a lineup not validated with its competition and the time left", () => {
    const due = {
      kind: "lineup",
      evening: "e",
      ref: "l1:c1",
      payload: { ...league, league_name: "Les Lièvres", competition_slug: "meeting-paris", competition_name: "Meeting de Paris", lock_at: at(45) },
    };
    expect(notificationOf(due, now)).toMatchObject({ url: "/manager/l1/alignement/meeting-paris", tag: "lineup-l1:c1" });
    for (const t of texts(due)) expect(t).toMatch(/45 min.*Meeting de Paris.*Les Lièvres$/);
  });

  it("tells a head-to-head won, lost, drawn, and a rout when the winner has half as much again", () => {
    const due = (my: number, their: number) => ({
      kind: "duel_over",
      evening: "e",
      ref: "l1:3",
      payload: { ...duel, round: 3, opponent: "Gazelle", my_score: my, their_score: their },
    });
    expect(notificationOf(due(2310, 1980))).toMatchObject({ url: "/manager/l1/confrontation/3/u9", tag: "duel_over-l1:3" });
    for (const t of texts(due(2310, 1980))) expect(t).toMatch(/Victoire 2310-1980, journée 3.*Gazelle/);
    for (const t of texts(due(1980, 2310))) expect(t).toMatch(/Défaite 1980-2310, journée 3.*Gazelle/);
    for (const t of texts(due(40, 40))) expect(t).toMatch(/Nul 40-40, journée 3.*Gazelle/);
    for (const t of texts(due(52, 18))) expect(t).toMatch(/Raclée 52-18.*Gazelle/);
    for (const t of texts(due(18, 52))) expect(t).toMatch(/Raclée 18-52.*Gazelle/);
    for (const t of texts(due(5, 4))) expect(t).toMatch(/Victoire 5-4/);
    for (const t of texts(due(3, 0))) expect(t).toMatch(/Raclée 3-0/);
  });

  it("tells who reacted to my moment, and how many others", () => {
    const due = (count: number) => ({
      kind: "moment_reaction",
      evening: "e",
      payload: { ...league, count, pseudo: "Gazelle" },
    });
    expect(notificationOf(due(3))).toMatchObject({ url: "/ligues/l1?onglet=fil", tag: "moment_reaction" });
    for (const t of texts(due(3))) expect(t).toContain("Gazelle +2 ont réagi");
    for (const t of texts(due(1))) expect(t).toContain("Gazelle a réagi");
  });

  it("tells the reveal of a mercato round from my side: all, some, none, no bid, the end", () => {
    const due = (p: object) => ({ kind: "mercato_reveal", evening: "e", ref: "l1:2", payload: { ...reveal, round: 2, ...p } });
    expect(notificationOf(due({}))).toMatchObject({ url: "/manager/l1/tour/2", tag: "mercato_reveal-l1:2" });
    for (const t of texts(due({ won: 3, bids: 3 }))) expect(t).toMatch(/3 sur 3/);
    for (const t of texts(due({ won: 0, bids: 3 }))) expect(t).toMatch(/0 sur 3/);
    const lost = { pseudo: "Gazelle", athlete: "Athlète Démo", diff: 3 };
    for (const t of texts(due({ lost }))) expect(t).toMatch(/2 sur 4 \|.*(Gazelle.*Athlète Démo|Athlète Démo.*Gazelle).*\+3 cr\./);
    for (const t of texts(due({ lost: { ...lost, diff: 0 } }))) expect(t).not.toContain("+0");
    for (const t of texts(due({ won: 0, bids: 0 }))) expect(t).toContain("Tour 2 révélé");
    for (const t of texts(due({ last: true }))) expect(t).toMatch(/Mercato|mercato.*2 sur 4 au dernier tour/);
  });

  it("tells each trash talk with the league, the place, the other player or the final", () => {
    const due = (p: object) => ({
      kind: "trash_talk",
      evening: "2026-11-11",
      payload: { ...league, league_name: "Les Lièvres", rank: 4, players: 8, ...p },
    });
    expect(notificationOf(due({ trigger: "last" }))).toMatchObject({ url: "/ligues/l1", tag: "trash_talk-2026-11-11" });
    for (const t of texts(due({ trigger: "overtaken", other: "Gazelle" }))) expect(t).toMatch(/Gazelle.*4e sur 8.*Les Lièvres$/);
    for (const t of texts(due({ trigger: "overtook", other: "Gazelle" }))) expect(t).toMatch(/Gazelle.*4e sur 8.*Les Lièvres$/);
    for (const t of texts(due({ trigger: "last", rank: 8 }))) expect(t).toMatch(/[Ll]anterne rouge.*8e sur 8.*Les Lièvres$/);
    for (const t of texts(due({ trigger: "lone_miss", event: { slug: "800m-h", discipline: "800 m", gender: "M" } })))
      expect(t).toMatch(/\| 800 m H.*Les Lièvres$|\| …sauf toi : 800 m H/);
    for (const t of texts(due({ trigger: "lone_find", event: { slug: "800m-h", discipline: "800 m", gender: "M" } })))
      expect(t).toMatch(/\| 800 m H : .*Les Lièvres$/);
  });

  it("tells a trophy won with its statuette, its place, its points and its league, and opens the profile", () => {
    const trophy = (p: object) => ({
      kind: "trophy",
      evening: "e",
      ref: "n1",
      payload: { ...league, season: 2026, metal: null, animal: null, points: null, ...p },
    });
    const podium = texts(trophy({ trophy: "league", metal: "gold", animal: "guepard" }));
    expect(podium.some((t) => t.includes("Guépard d'or"))).toBe(true);
    for (const t of podium) expect(t).toMatch(/1er au classement final.*Les Lièvres/);
    expect(texts(trophy({ trophy: "manager", metal: "silver" }))[0]).toContain("Lièvre d'argent");
    for (const t of texts(trophy({ trophy: "chrono", points: 84 }))) expect(t).toContain("84 pts");
    for (const t of texts(trophy({ trophy: "record", points: 212 }))) expect(t).toContain("212 pts");
    const general = texts(
      trophy({ trophy: "general", metal: "bronze", league_id: null, league_name: null }),
    );
    for (const t of general) expect(t).toMatch(/Top 10/);
    expect(texts(trophy({ trophy: "witness", league_name: null }))[0]).toContain("Témoin d'or");
    expect(notificationVariants(trophy({ trophy: "witness" }), now)).toMatchObject({
      url: "/profil",
      tag: "trophy-n1",
    });
  });

  it("tells the competition whose programme is out", () => {
    const due = { competition_slug: "meeting-paris-2027", competition_name: "Meeting de Paris" };
    const v = programVariants(due);
    expect(v).toMatchObject({ url: "/competitions?competition=meeting-paris-2027", tag: "program-meeting-paris-2027" });
    for (const { body } of v.variants) expect(body).toContain("Meeting de Paris");
  });
});
