import { validateCode, validateEmail } from "@/domain/auth";

import { UseCaseError } from "./errors";

/**
 * Port: changing the signed-in player's sign-in address (#341). A code goes to the new address,
 * which replaces the old one only once the code is typed. Real adapter = Supabase Auth, fake =
 * in memory.
 */
export interface EmailChangeService {
  request(newEmail: string): Promise<"sent" | "taken">;
  /** False when the code is wrong, expired or already used. */
  confirm(newEmail: string, code: string): Promise<boolean>;
}

export function requestEmailChange(ports: { emails: EmailChangeService }) {
  return {
    async execute(input: { newEmail: string; currentEmail: string }): Promise<string> {
      const email = validateEmail(input.newEmail);
      if (!email.ok) throw new UseCaseError(email.code);
      if (email.email === input.currentEmail.toLowerCase())
        throw new UseCaseError("EMAIL_UNCHANGED");
      if ((await ports.emails.request(email.email)) === "taken")
        throw new UseCaseError("EMAIL_TAKEN");
      return email.email;
    },
  };
}

export function confirmEmailChange(ports: { emails: EmailChangeService }) {
  return {
    async execute(input: { newEmail: string; code: string }): Promise<void> {
      const email = validateEmail(input.newEmail);
      if (!email.ok) throw new UseCaseError(email.code);
      const code = validateCode(input.code);
      if (!code.ok) throw new UseCaseError(code.code);
      if (!(await ports.emails.confirm(email.email, code.code)))
        throw new UseCaseError("CODE_INVALID");
    },
  };
}
