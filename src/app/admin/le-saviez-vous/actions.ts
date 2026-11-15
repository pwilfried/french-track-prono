"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { deleteFunFact, saveFunFact, setFunFactsEnabled } from "@/application/fun-facts";
import type { FunFactTag } from "@/domain/fun-facts";
import { createSupabaseFunFactRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type FunFactState = { error?: ErrorCode; saved?: boolean };

const PAGE = "/admin/le-saviez-vous";

async function run(
  work: (facts: ReturnType<typeof createSupabaseFunFactRepository>) => Promise<unknown>,
) {
  const { client } = await adminOnly();
  try {
    await work(createSupabaseFunFactRepository(client));
    revalidatePath(PAGE);
    revalidatePath("/");
    return { saved: true };
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

/** Adds a fact (no id) or edits one (#766). */
export async function saveFunFactAction(_: FunFactState, data: FormData): Promise<FunFactState> {
  return run((facts) =>
    saveFunFact({ facts }).execute({
      id: formText(data, "id") || null,
      fact: {
        title: formText(data, "title"),
        body: formText(data, "body"),
        // An unknown tag is refused by the domain check.
        tag: formText(data, "tag") as FunFactTag,
        source: formText(data, "source"),
        active: data.get("active") === "on",
        competitionSlug: formText(data, "competition") || null,
        discipline: formText(data, "discipline") || null,
        startsOn: formText(data, "startsOn") || null,
        endsOn: formText(data, "endsOn") || null,
      },
    }),
  );
}

export async function deleteFunFactAction(_: FunFactState, data: FormData): Promise<FunFactState> {
  return run((facts) => deleteFunFact({ facts }).execute({ id: formText(data, "id") }));
}

/** Switches the card on or off: the next opening of the home follows it, no deploy. */
export async function setFunFactsEnabledAction(
  _: FunFactState,
  data: FormData,
): Promise<FunFactState> {
  return run((facts) =>
    setFunFactsEnabled({ facts }).execute({ enabled: formText(data, "enabled") === "on" }),
  );
}
