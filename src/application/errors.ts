/** Error codes of the use cases. The UI maps them to French messages (src/app/messages.fr.ts). */
export type ErrorCode =
  | "EVENTS_UNAVAILABLE"
  | "EVENT_NOT_FOUND"
  | "EMAIL_INVALID"
  | "CODE_INVALID"
  | "AUTH_UNAVAILABLE"
  | "AGE_NOT_CONFIRMED"
  | "PSEUDO_INVALID"
  | "PSEUDO_TAKEN"
  | "AVATAR_INVALID"
  | "PROFILE_EXISTS"
  | "PROFILE_UNAVAILABLE";

export class UseCaseError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "UseCaseError";
  }
}
