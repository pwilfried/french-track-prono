export type EmailResult = { ok: true; email: string } | { ok: false; code: "EMAIL_INVALID" };
export type CodeResult = { ok: true; code: string } | { ok: false; code: "CODE_INVALID" };

const MAX_EMAIL_LENGTH = 254;
// Deliberately simple: the mail server is the real judge of an address.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and lowercases an address, and checks its shape. */
export function validateEmail(input: string): EmailResult {
  const email = input.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_SHAPE.test(email)) {
    return { ok: false, code: "EMAIL_INVALID" };
  }
  return { ok: true, email };
}

/** The sign-in code is six digits; spaces and hyphens typed or pasted with it are ignored. */
export function validateCode(input: string): CodeResult {
  const code = input.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false, code: "CODE_INVALID" };
  return { ok: true, code };
}
