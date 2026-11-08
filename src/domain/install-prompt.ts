/**
 * How this device can put the app on its home screen: the browser's own prompt (Chrome, Edge,
 * Android), the iPhone share menu, or not at all from an in-app browser, which must first open the
 * link in a real browser.
 */
export type InstallWay = "browser" | "ios" | "in-app";

// ponytail: known app tokens only; add one when another app's in-app browser shows up.
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|musical_ly|BytedanceWebview|Snapchat|LinkedInApp/i;
// ponytail: iPadOS Safari sends a desktop user agent and is treated as a regular browser.
const IOS = /iPhone|iPad|iPod/;

/** Null when the app already runs from the home screen. */
export function installWay(device: { userAgent: string; standalone: boolean }): InstallWay | null {
  if (device.standalone) return null;
  if (IN_APP.test(device.userAgent)) return "in-app";
  if (IOS.test(device.userAgent)) return "ios";
  return "browser";
}

/**
 * Whether to offer "add to home screen": only to a signed-in player who already predicted, and
 * never again once they closed the offer. The browser prompt waits for the second visit; the
 * iPhone and in-app guides show from the first, since that player may not come back.
 */
export function shouldOfferInstall(state: {
  signedIn: boolean;
  hasPredicted: boolean;
  /** Visits counted on this device, this one included. */
  sessions: number;
  dismissed: boolean;
  way: InstallWay | null;
}): boolean {
  if (!state.way || !state.signedIn || !state.hasPredicted || state.dismissed) return false;
  return state.way !== "browser" || state.sessions >= 2;
}
