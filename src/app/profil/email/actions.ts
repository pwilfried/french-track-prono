"use server";

import { redirect } from "next/navigation";

import { confirmEmailChange, requestEmailChange } from "@/application/change-email";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { createSupabaseEmailChangeService } from "@/infra";

import { formText } from "../../form-data";
import { getCurrentUser, getSessionClient } from "../../session";

export type EmailChangeState = { step: "ask" | "code"; email: string; error?: ErrorCode };

/** First the new address (a code is sent there), then the code: the address changes (#341). */
export async function changeEmailAction(
  state: EmailChangeState,
  data: FormData,
): Promise<EmailChangeState> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/profil/email");
  const emails = createSupabaseEmailChangeService(await getSessionClient());
  try {
    if (state.step === "code") {
      await confirmEmailChange({ emails }).execute({
        newEmail: state.email,
        code: formText(data, "code"),
      });
    } else {
      const email = await requestEmailChange({ emails }).execute({
        newEmail: formText(data, "email"),
        currentEmail: user.email,
      });
      return { step: "code", email };
    }
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { ...state, error: error.code };
    throw error;
  }
  redirect("/profil?email=1");
}
