import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getEvent } from "@/application/get-event";
import { eventPhase } from "@/domain/countdown";
import { eventSlugOfPath, safeRedirectPath } from "@/domain/redirect";

import { messages } from "../messages.fr";
import { getCurrentUser } from "../session";
import { SignInForm } from "./sign-in-form";
import { publicEventReader } from "../public-data";

/** The name of the open event `next` points to (« 100 m femmes »), null for any other page. */
async function waitingEventName(next: string): Promise<string | null> {
  const slug = eventSlugOfPath(next);
  if (!slug) return null;
  try {
    const events = publicEventReader();
    const event = await getEvent({ events }).execute({ competitionSlug: null, eventSlug: slug });
    if (eventPhase(new Date(), event.lockAt) !== "open") return null;
    return messages.events.name(event.discipline, event.gender);
  } catch (error) {
    // An unknown or unreadable event only drops the reminder: signing in still works.
    if (error instanceof UseCaseError) return null;
    throw error;
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { next: rawNext, erreur } = await searchParams;
  const next = safeRedirectPath(rawNext);
  if (await getCurrentUser()) redirect(next);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <SignInForm
        next={next}
        linkError={erreur === "lien"}
        eventName={await waitingEventName(next)}
      />
    </main>
  );
}
