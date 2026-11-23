import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { Animal } from "@/components/band/animal";
import { buttonVariants } from "@/components/ui/button";
import type { Animal as AnimalName } from "@/domain/band";
import type { Bib as BibValue } from "@/domain/bib";
import { cn } from "@/lib/utils";

import { Bib } from "./bib";
import { ProfileHelp } from "./profile-help";
import { ShareSeasonCard } from "./share-season-card";

const text = messages.profile.card;

/**
 * The athlete card at the top of the profile (#1138): the animal, the bib (a link to the edit
 * page) and the pseudo, the animal and its family, the club, then the season points and the rank
 * as two tiles and the two actions. With no computed event yet (`figures` null) the tiles and the
 * share button give way to the edit button alone.
 */
export function AthleteCard({
  pseudo,
  bib,
  animal,
  club,
  since,
  figures,
}: {
  pseudo: string;
  bib: BibValue;
  animal: AnimalName | null;
  /** The club, only when it is validated. */
  club: string | null;
  since: string;
  figures: { points: number; rank: number | null; players: number } | null;
}) {
  return (
    <section
      aria-labelledby="me"
      className="flex flex-col gap-4 rounded-[20px] bg-brand-ink p-4 text-brand-foreground dark:bg-card dark:text-foreground"
    >
      <div className="flex items-center gap-4">
        <Animal kind={animal ?? "locked"} size="large" label className="size-[76px] shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p id="me" className="flex min-w-0 items-center gap-2">
            <Link
              href="/profil/modifier"
              aria-label={text.editBib}
              className="-m-2 inline-flex min-h-11 shrink-0 items-center p-2"
            >
              <Bib bib={bib} />
            </Link>
            <span className="min-w-0 break-words font-display text-xl font-extrabold">
              {pseudo}
            </span>
          </p>
          <p className="font-semibold text-secondary">
            {animal
              ? `${messages.band.animals[animal]} · ${messages.band.families[animal]}`
              : messages.band.noAnimal}
          </p>
          <p className="text-xs opacity-80">{text.since(club, since)}</p>
        </div>
      </div>
      {figures && (
        <dl className="grid grid-cols-2 gap-2">
          <Tile>
            <dt className="text-xs opacity-80">{text.points}</dt>
            <dd className="font-mono text-2xl font-bold">{figures.points}</dd>
          </Tile>
          <Tile>
            <dt className="text-xs opacity-80">
              {figures.rank ? text.outOf(figures.players) : text.notRanked}
            </dt>
            {figures.rank && (
              <dd className="font-mono text-2xl font-bold">{text.rank(figures.rank)}</dd>
            )}
          </Tile>
        </dl>
      )}
      <div className="flex flex-col gap-2">
        <Link
          href="/profil/modifier"
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          {text.edit}
        </Link>
        {figures && <ShareSeasonCard />}
      </div>
      <ProfileHelp className="self-center" />
    </section>
  );
}

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-white/10 p-3 dark:bg-muted">
      {children}
    </div>
  );
}
