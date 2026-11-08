"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { setScoringRule } from "@/application/scoring-rules";
import { createSupabaseScoringRuleRepository } from "@/infra";

import { formText } from "../../form-data";
import { adminOnly } from "../guard";

export type RuleState = { error?: ErrorCode; saved?: boolean };

export async function saveRuleAction(_: RuleState, data: FormData): Promise<RuleState> {
  const { client } = await adminOnly();
  try {
    await setScoringRule({ rules: createSupabaseScoringRuleRepository(client) }).execute({
      key: formText(data, "key"),
      value: Number(formText(data, "value").replace(",", ".")),
    });
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/bareme");
  return { saved: true };
}
