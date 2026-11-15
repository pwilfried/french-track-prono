import { describe, expect, it } from "vitest";

import type { FunFact, FunFactDraft } from "@/domain/fun-facts";

import { UseCaseError } from "./errors";
import {
  deleteFunFact,
  getFunFacts,
  listFunFactsForAdmin,
  saveFunFact,
  setFunFactsEnabled,
  type AdminFunFact,
  type FunFactRepository,
} from "./fun-facts";

// Application tests do not import the infra layer: a few lines of fake are enough here.
function fakeFacts(initial: AdminFunFact[] = []): FunFactRepository {
  let facts = [...initial];
  let enabled = true;
  return {
    async enabled() {
      return enabled;
    },
    async active() {
      return facts
        .filter((f) => f.active)
        .map((f) => ({
          id: f.id,
          title: f.title,
          body: f.body,
          tag: f.tag,
          competitionSlug: f.competitionSlug,
          discipline: f.discipline,
          startsOn: f.startsOn,
          endsOn: f.endsOn,
        }));
    },
    async all() {
      return facts;
    },
    async save(id, fact) {
      const next = { ...fact, id: id ?? `f${facts.length + 1}` };
      facts = id ? facts.map((f) => (f.id === id ? next : f)) : [...facts, next];
      return next.id;
    },
    async remove(id) {
      facts = facts.filter((f) => f.id !== id);
    },
    async setEnabled(value) {
      enabled = value;
    },
  };
}

const draft = (title: string, change: Partial<FunFactDraft> = {}): FunFactDraft => ({
  title,
  body: "Un fait vérifié.",
  tag: "oddity",
  source: "https://example.test/source",
  active: true,
  competitionSlug: null,
  discipline: null,
  startsOn: null,
  endsOn: null,
  ...change,
});

const today = {
  day: "2027-06-11",
  competitions: [{ slug: "meeting-test", startsOn: "2027-06-10", endsOn: "2027-06-12" }],
  disciplines: ["100 m"],
};

const game: FunFact = { ...draft("Le joker"), id: "game-joker" };

describe("the « Le saviez-vous ? » card", () => {
  it("shows the active facts and the facts about the game, never a disabled one", async () => {
    // Given a bank with an active fact and a disabled one
    const facts = fakeFacts([
      { ...draft("Actif"), id: "a" },
      { ...draft("Désactivé", { active: false }), id: "b" },
    ]);
    // When the player opens the home
    const shown = await getFunFacts({ facts }).execute({ today, gameFacts: [game] });
    // Then the card offers the active fact and the game fact
    expect(shown.map((f) => f.title).sort()).toEqual(["Actif", "Le joker"]);
  });

  it("shows the fact tied to tonight's 100 m first", async () => {
    const facts = fakeFacts([
      { ...draft("Un"), id: "a" },
      { ...draft("Sprint", { competitionSlug: "meeting-test", discipline: "100 m" }), id: "b" },
      { ...draft("Deux"), id: "c" },
    ]);
    const shown = await getFunFacts({ facts }).execute({ today, gameFacts: [game] });
    expect(shown[0]!.title).toBe("Sprint");
  });

  it("shows nothing once the admin switches the card off", async () => {
    const facts = fakeFacts([{ ...draft("Actif"), id: "a" }]);
    await setFunFactsEnabled({ facts }).execute({ enabled: false });
    expect(await getFunFacts({ facts }).execute({ today, gameFacts: [game] })).toEqual([]);
  });
});

describe("the admin's bank of facts", () => {
  it("adds, edits, disables and deletes a fact", async () => {
    const facts = fakeFacts();
    const id = await saveFunFact({ facts }).execute({ id: null, fact: draft(" Nouveau ") });
    expect((await listFunFactsForAdmin({ facts }).execute()).facts[0]).toMatchObject({
      id,
      title: "Nouveau",
      source: "https://example.test/source",
    });

    await saveFunFact({ facts }).execute({ id, fact: draft("Corrigé", { active: false }) });
    const { facts: edited, enabled } = await listFunFactsForAdmin({ facts }).execute();
    expect(edited[0]).toMatchObject({ title: "Corrigé", active: false });
    expect(enabled).toBe(true);

    await deleteFunFact({ facts }).execute({ id });
    expect((await listFunFactsForAdmin({ facts }).execute()).facts).toEqual([]);
  });

  it("refuses a fact without a title, with a code", async () => {
    await expect(
      saveFunFact({ facts: fakeFacts() }).execute({ id: null, fact: draft("") }),
    ).rejects.toEqual(new UseCaseError("FUN_FACT_TEXT_INVALID"));
  });
});
