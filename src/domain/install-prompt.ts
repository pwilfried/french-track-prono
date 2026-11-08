/**
 * Whether to offer "add to home screen": only to a signed-in player who already predicted, never
 * on the first visit, and never again once they closed the offer.
 */
export function shouldOfferInstall(state: {
  signedIn: boolean;
  hasPredicted: boolean;
  /** Visits counted on this device, this one included. */
  sessions: number;
  dismissed: boolean;
}): boolean {
  return state.signedIn && state.hasPredicted && state.sessions >= 2 && !state.dismissed;
}
