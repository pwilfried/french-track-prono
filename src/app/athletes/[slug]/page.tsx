import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getAthlete } from "@/application/get-athlete";
import { AthleteSheetView } from "@/components/athletes/athlete-sheet";
import { utcToParis } from "@/domain/competition";
import { eventReturnPath, managerReturnPath } from "@/domain/redirect";
import { createPublicSupabaseClient, createSupabaseAthleteReader } from "@/infra";

import { messages } from "../../messages.fr";

async function load(slug: string) {
  try {
    return await getAthlete({
      athletes: createSupabaseAthleteReader(createPublicSupabaseClient()),
    }).execute({ slug });
  } catch (error) {
    if (error instanceof UseCaseError) {
      if (error.code === "ATHLETE_NOT_FOUND") notFound();
      return "error" as const;
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const athlete = await load((await params).slug);
  return athlete === "error" ? {} : { title: messages.athlete.profileOf(athlete.name) };
}

/** Where the back link leads: the page the athlete was opened from (#679), else the competitions. */
function backOf(from: string | null): { href: string; label: string } {
  // From an event: back to the podium being built, in view (#699).
  const event = eventReturnPath(from);
  if (event) return { href: `${event}#podium`, label: messages.picker.podium };
  const manager = managerReturnPath(from);
  if (manager) return { href: manager, label: messages.athlete.back };
  return { href: "/competitions", label: messages.event.back };
}

export default async function AthletePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { slug } = await params;
  const { from } = await searchParams;
  const back = backOf(typeof from === "string" ? from : null);
  const athlete = await load(slug);
  const season = Number(utcToParis(new Date().toISOString()).slice(0, 4));

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-4">
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
        >
          ‹ {back.label}
        </Link>
        {athlete === "error" ? (
          <AthleteSheetView status="error" season={season} retryHref={`/athletes/${slug}`} />
        ) : (
          <AthleteSheetView sheet={athlete} season={season} />
        )}
      </div>
    </main>
  );
}
