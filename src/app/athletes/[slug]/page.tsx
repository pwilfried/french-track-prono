import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getAthlete } from "@/application/get-athlete";
import { AthleteHero } from "@/components/athletes/athlete-hero";
import { RecentRaces } from "@/components/athletes/recent-races";
import { RecordsRow } from "@/components/athletes/records-row";
import { ErrorNotice } from "@/components/error-notice";
import { recordRows } from "@/domain/athlete";
import { createPublicSupabaseClient, createSupabaseAthleteReader } from "@/infra";

import { currentCompetition } from "../../competition";
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

export default async function AthletePage({ params }: { params: Promise<{ slug: string }> }) {
  const competition = await currentCompetition();
  const { slug } = await params;
  const athlete = await load(slug);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-4">
        <Link
          href="/epreuves"
          className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
        >
          ‹ {messages.event.back}
        </Link>
        {athlete === "error" ? (
          <ErrorNotice
            retryHref={`/athletes/${slug}`}
            message={messages.errors.ATHLETES_UNAVAILABLE}
          />
        ) : (
          <>
            <AthleteHero
              name={athlete.name}
              countryCode={athlete.countryCode}
              gender={athlete.gender}
            />
            <section aria-labelledby="records-title" className="flex flex-col gap-2">
              <h2
                id="records-title"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {messages.athlete.records}
              </h2>
              <RecordsRow rows={recordRows(athlete.records)} />
              <p className="text-xs text-muted-foreground">{messages.athlete.recordsHint}</p>
            </section>
            <section aria-labelledby="races-title" className="flex flex-col gap-2">
              <h2
                id="races-title"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {messages.athlete.races}
              </h2>
              <RecentRaces
                races={athlete.races}
                timeZone={competition.timeZone}
                linkable={(race) => race.competitionSlug === competition.slug}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
