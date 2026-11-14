import { raisePreprodEmailRateLimit } from "../src/infra/contract/preprod-auth";

/**
 * Global set-up of the runs against pre-production (#787): the hourly cap on sign-in e-mails is
 * raised before the suite signs up its players (src/infra/contract/preprod-auth.ts). A refused
 * change is only a warning: the run goes on, and the log says why sign-ups may fail.
 * Does nothing locally nor in the CI of a PR.
 */
export default async function raiseEmailRateLimitOnPreprod(): Promise<void> {
  const outcome = await raisePreprodEmailRateLimit();
  if (outcome.kind === "raised") {
    console.log(
      `Pre-production e-mail limit raised from ${outcome.from} to ${outcome.to} an hour.`,
    );
  } else if (outcome.kind === "kept") {
    console.log(`Pre-production e-mail limit kept at ${outcome.current} an hour.`);
  } else if (outcome.kind === "failed") {
    console.warn(
      `::warning::Pre-production e-mail limit not raised (${outcome.reason}): sign-ups may fail with AUTH_UNAVAILABLE once the hourly cap is hit.`,
    );
  }
}
