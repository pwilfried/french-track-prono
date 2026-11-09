import type { AdminClub } from "@/application/club-admin";

import { messages } from "../../messages.fr";
import { ClubForm, DeleteClubForm, ValidateClubForm } from "./club-forms";

const text = messages.adminClubs;

/** The clubs found, those to validate first, each with its forms. */
export function ClubList({ clubs }: { clubs: AdminClub[] }) {
  return (
    <ul aria-label={text.title} className="flex flex-col gap-3">
      {clubs.map((club) => (
        <li
          key={club.id}
          className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
        >
          <div>
            <p className="font-extrabold [overflow-wrap:anywhere]">
              {club.name}
              {club.validated ? null : (
                <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold-ink">
                  {text.pending}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {[
                club.city,
                club.department,
                text.source[club.source],
                text.players(club.playerCount),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {club.validated ? null : <ValidateClubForm id={club.id} />}
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-brand dark:text-secondary">
              {text.edit}
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <ClubForm club={club} />
              <DeleteClubForm id={club.id} name={club.name} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
