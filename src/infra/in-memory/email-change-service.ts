import type { EmailChangeService } from "@/application/change-email";

/**
 * Test double of the EmailChangeService port, for one player. `taken` lists the addresses of
 * other players; `latestCode` reads the code "sent" to the new address.
 */
export function createInMemoryEmailChangeService(options: {
  email: string;
  taken?: string[];
}): EmailChangeService & { latestCode(email: string): Promise<string>; currentEmail(): string } {
  let current = options.email;
  const taken = new Set(options.taken ?? []);
  const pending = new Map<string, string>();
  let counter = 0;
  return {
    async request(newEmail) {
      if (taken.has(newEmail)) return "taken";
      counter += 1;
      pending.clear();
      pending.set(newEmail, String(200000 + counter));
      return "sent";
    },
    async confirm(newEmail, code) {
      if (pending.get(newEmail) !== code) return false;
      pending.delete(newEmail);
      current = newEmail;
      return true;
    },
    async latestCode(email) {
      const code = pending.get(email);
      if (!code) throw new Error(`no code was sent to ${email}`);
      return code;
    },
    currentEmail: () => current,
  };
}
