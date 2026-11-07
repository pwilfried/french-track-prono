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
  | "PROFILE_UNAVAILABLE"
  | "NOT_ADMIN"
  | "ATHLETE_NOT_IN_EVENT"
  | "RESULT_INVALID"
  | "RESULTS_UNAVAILABLE"
  | "LEAGUE_NAME_INVALID"
  | "LEAGUE_CODE_UNKNOWN"
  | "ALREADY_MEMBER"
  | "LEAGUE_FULL"
  | "LEAGUE_NOT_FOUND"
  | "LEAGUE_OWNER_MUST_HAND_OVER"
  | "NOT_LEAGUE_OWNER"
  | "LEAGUE_MEMBER_UNKNOWN"
  | "LEAGUES_UNAVAILABLE"
  | "RANKING_UNAVAILABLE"
  | "RESULT_MISSING"
  | "EVENT_NOT_LOCKED"
  | "POINTS_UNAVAILABLE"
  | "PODIUM_INVALID"
  | "PREDICTION_LOCKED"
  | "JOKER_ALREADY_USED"
  | "PREDICTION_UNAVAILABLE"
  | "DELETION_NOT_CONFIRMED";

export class UseCaseError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "UseCaseError";
  }
}
