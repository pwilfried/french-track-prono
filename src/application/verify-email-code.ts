import { validateCode, validateEmail } from "@/domain/auth";

import { UseCaseError } from "./errors";
import type { AuthService, AuthSession } from "./request-magic-link";

export type VerifyEmailCodeInput = { email: string; code: string };

export function verifyEmailCode(ports: { auth: AuthService }) {
  return {
    async execute(input: VerifyEmailCodeInput): Promise<AuthSession> {
      const email = validateEmail(input.email);
      if (!email.ok) throw new UseCaseError(email.code);
      const code = validateCode(input.code);
      if (!code.ok) throw new UseCaseError(code.code);

      const session = await ports.auth.verifyEmailCode(email.email, code.code);
      if (!session) throw new UseCaseError("CODE_INVALID");
      return session;
    },
  };
}
