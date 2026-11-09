import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/infra/sentry";

// Browser: unhandled errors and promise rejections (#195).
Sentry.init(sentryOptions());
