"use server";

import { revalidatePath } from "next/cache";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { setManagerRules } from "@/application/manager-rules";
import { createSupabaseManagerRuleRepository } from "@/infra";

import { adminOnly } from "../guard";
import { parseManagerRulesForm } from "./parse-form";

export type ManagerRulesState = { error?: ErrorCode; saved?: boolean };

export async function saveManagerRulesAction(
  _: ManagerRulesState,
  data: FormData,
): Promise<ManagerRulesState> {
  const { client } = await adminOnly();
  try {
    await setManagerRules({ rules: createSupabaseManagerRuleRepository(client) }).execute(
      parseManagerRulesForm(data),
    );
  } catch (error) {
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
  revalidatePath("/admin/manager");
  return { saved: true };
}
