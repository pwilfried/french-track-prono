import { validateEmail } from "@/domain/auth";

import { UseCaseError } from "./errors";

/** A signed-in player. The session itself (cookies) is handled by the app layer. */
export type AuthSession = { userId: string };

/** Port: e-mail sign-in (Supabase Auth in production, memory in tests). */
export interface AuthService {
  /** Sends one message holding a magic link and a 6-digit code. Throws AUTH_UNAVAILABLE on failure. */
  sendEmailCode(email: string, redirectTo?: string): Promise<void>;
  /** Signs in with the code. Returns null when the code is wrong, expired or already used. */
  verifyEmailCode(email: string, code: string): Promise<AuthSession | null>;
}

export type RequestMagicLinkInput = { email: string; redirectTo?: string };

export function requestMagicLink(ports: { auth: AuthService }) {
  return {
    async execute(input: RequestMagicLinkInput): Promise<void> {
      const email = validateEmail(input.email);
      if (!email.ok) throw new UseCaseError(email.code);
      await ports.auth.sendEmailCode(email.email, input.redirectTo);
    },
  };
}
