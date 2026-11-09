import * as Sentry from "@sentry/nextjs";

import { UseCaseError } from "@/application/errors";

/**
 * Sends to Sentry an error a catch block would otherwise hide (#195). Not sent: a UseCaseError (a
 * player's mistake, or an outage already reported by onUnavailable) and a share the player
 * cancelled. A no-op while Sentry is off.
 */
export function reportError(error: unknown, where: string): void {
  if (error instanceof UseCaseError) return;
  if (error instanceof DOMException && error.name === "AbortError") return;
  Sentry.captureException(error, { tags: { where } });
}
