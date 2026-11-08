"use server";

import { redirect } from "next/navigation";

import { UseCaseError, type ErrorCode } from "@/application/errors";
import { getProfile } from "@/application/get-profile";
import { requestMagicLink } from "@/application/request-magic-link";
import { verifyEmailCode } from "@/application/verify-email-code";
import { safeRedirectPath } from "@/domain/redirect";
import { createSupabaseAuthService, createSupabaseProfileRepository } from "@/infra";

import { formText } from "../form-data";
import { landingAfterSignIn } from "../landing";
import { getSessionClient } from "../session";

export type SignInState = {
  step: "email" | "code";
  email: string;
  error?: ErrorCode;
  resent?: boolean;
};

async function codeOf<T>(work: () => Promise<T>): Promise<{ value: T } | { error: ErrorCode }> {
  try {
    return { value: await work() };
  } catch (error) {
    // Only known error codes are expected here; anything else is a bug and stays visible.
    if (error instanceof UseCaseError) return { error: error.code };
    throw error;
  }
}

/** One action for the whole form; the button pressed says what to do (`intent`). */
export async function signInAction(_: SignInState, data: FormData): Promise<SignInState> {
  const email = formText(data, "email");
  const intent = formText(data, "intent");
  const client = await getSessionClient();

  if (intent === "change") return { step: "email", email };

  if (intent === "send" || intent === "resend") {
    const resend = intent === "resend";
    const result = await codeOf(() =>
      requestMagicLink({ auth: createSupabaseAuthService(client) }).execute({ email }),
    );
    if ("error" in result) return { step: resend ? "code" : "email", email, error: result.error };
    return { step: "code", email: email.trim().toLowerCase(), resent: resend || undefined };
  }

  const next = safeRedirectPath(formText(data, "next"));
  const result = await codeOf(async () => {
    const session = await verifyEmailCode({ auth: createSupabaseAuthService(client) }).execute({
      email,
      code: formText(data, "code"),
    });
    const profile = await getProfile({
      profiles: createSupabaseProfileRepository(client),
    }).execute({ userId: session.userId });
    return profile ? landingAfterSignIn(client, session.userId, next) : null;
  });
  if ("error" in result) return { step: "code", email, error: result.error };

  // A new player creates a profile first; they land on `next` afterwards.
  redirect(result.value ?? `/bienvenue?next=${encodeURIComponent(next)}`);
}
