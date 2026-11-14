import Link from "next/link";

import { checkManagerInvite } from "@/application/manager-leagues";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";

import { messages } from "../../messages.fr";
import { readOr } from "../../read-or";
import { managerPorts } from "../data";
import { JoinManagerLeagueForm } from "../join-forms";

/**
 * Joining a Manager league with its code; the invite link fills it in (`?code=K7M2QX`, #420). A
 * league whose mercato is open or that is full says so instead of the button (#781).
 */
export default async function JoinManagerLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code : "";
  const ports = await managerPorts(
    initialCode
      ? `/manager/rejoindre?code=${encodeURIComponent(initialCode)}`
      : "/manager/rejoindre",
  );
  // The database refuses anyway: when the status cannot be read, the form stays.
  const status = initialCode
    ? await readOr(
        "manager invite status",
        checkManagerInvite(ports).execute({ code: initialCode }),
        "open",
      )
    : "open";
  const closed =
    status === "mercato_open"
      ? messages.errors.MERCATO_OPEN
      : status === "full"
        ? messages.errors.MANAGER_LEAGUE_FULL
        : null;
  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero
        title={messages.manager.joinTitle}
        subtitle={messages.manager.joinSubtitle}
        back={{ href: "/manager", label: messages.manager.back }}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        {closed ? (
          <>
            <p role="alert" className="rounded-card bg-muted p-4 font-semibold text-accent-text">
              {closed}
            </p>
            <Link href="/manager" className={`${buttonVariants({ variant: "muted" })} w-full`}>
              {messages.manager.joinClosedNext}
            </Link>
          </>
        ) : (
          <JoinManagerLeagueForm initialCode={initialCode} />
        )}
      </div>
    </main>
  );
}
