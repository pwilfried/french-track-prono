import * as Sentry from "@sentry/nextjs";

import { onUnavailable } from "@/application/errors";
import { sentryOptions } from "@/infra/sentry";

/** Server and edge start-up: Sentry, and every « service unavailable » use case error reported. */
export function register() {
  Sentry.init(sentryOptions());
  onUnavailable((code) => Sentry.captureMessage(code, { level: "error", tags: { code } }));
}

export const onRequestError = Sentry.captureRequestError;
