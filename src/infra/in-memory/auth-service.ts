import type { AuthService } from "@/application/request-magic-link";

/** Test double of the AuthService port. Also lets a test read the code "sent" to an address. */
export function createInMemoryAuthService(): AuthService & {
  latestCode(email: string): Promise<string>;
} {
  const codes = new Map<string, string>(); // address -> latest unused code
  let counter = 0;

  return {
    async sendEmailCode(email) {
      counter += 1;
      codes.set(email, String(100000 + counter));
    },
    async verifyEmailCode(email, code) {
      if (codes.get(email) !== code) return null;
      codes.delete(email); // a code works once
      return { userId: `user-${email}` };
    },
    async latestCode(email) {
      const code = codes.get(email);
      if (!code) throw new Error(`no code was sent to ${email}`);
      return code;
    },
  };
}
