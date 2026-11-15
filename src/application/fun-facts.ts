import {
  checkFunFact,
  factsOfTheDay,
  type FunFact,
  type FunFactDay,
  type FunFactDraft,
} from "@/domain/fun-facts";

import { UseCaseError } from "./errors";

/** A fact as the back-office edits it, with its source. */
export type AdminFunFact = FunFactDraft & { id: string };

/**
 * Port: the bank of « Le saviez-vous ? » facts (#766) and its on/off switch. A player reads the
 * active facts and the switch; the admin reads and writes everything. Real adapter = Supabase,
 * fake = in memory.
 */
export interface FunFactRepository {
  enabled(): Promise<boolean>;
  active(): Promise<FunFact[]>;
  /** Admin only: every fact, with its source. */
  all(): Promise<AdminFunFact[]>;
  /** Admin only: adds a fact (id null) or edits one; returns its id. */
  save(id: string | null, fact: FunFactDraft): Promise<string>;
  remove(id: string): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
}

/**
 * The facts the card shows today, in order: none when the admin switched it off. The facts about
 * the game, computed from the scale, join the bank.
 */
export function getFunFacts(ports: { facts: FunFactRepository }) {
  return {
    async execute(input: { today: FunFactDay; gameFacts: FunFact[] }): Promise<FunFact[]> {
      if (!(await ports.facts.enabled())) return [];
      return factsOfTheDay([...(await ports.facts.active()), ...input.gameFacts], input.today);
    },
  };
}

/** The back-office page: the switch and every fact. */
export function listFunFactsForAdmin(ports: { facts: FunFactRepository }) {
  return {
    async execute() {
      const [enabled, facts] = await Promise.all([ports.facts.enabled(), ports.facts.all()]);
      return { enabled, facts };
    },
  };
}

export function saveFunFact(ports: { facts: FunFactRepository }) {
  return {
    async execute(input: { id: string | null; fact: FunFactDraft }): Promise<string> {
      const checked = checkFunFact(input.fact);
      if ("error" in checked) throw new UseCaseError(checked.error);
      return ports.facts.save(input.id, checked);
    },
  };
}

export function deleteFunFact(ports: { facts: FunFactRepository }) {
  return { execute: (input: { id: string }) => ports.facts.remove(input.id) };
}

export function setFunFactsEnabled(ports: { facts: FunFactRepository }) {
  return { execute: (input: { enabled: boolean }) => ports.facts.setEnabled(input.enabled) };
}
