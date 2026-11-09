import { listAdminClubs, type AdminClub } from "@/application/club-admin";
import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import { likelyDuplicate } from "@/domain/club";
import { createSupabaseClubAdminRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { ClubForm } from "./club-forms";
import { ClubsAdmin, type ClubRow } from "./clubs-admin";

const text = messages.adminClubs;
const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** Back-office « Clubs » (#366, #381): the list, the duplicates to merge, a new club. */
export default async function AdminClubsPage() {
  const { client } = await adminOnly();
  let clubs: AdminClub[] | "error";
  try {
    clubs = await listAdminClubs({ clubs: createSupabaseClubAdminRepository(client) }).execute({
      query: "",
      pendingOnly: false,
      all: true,
    });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    clubs = "error";
  }
  const rows: ClubRow[] =
    clubs === "error"
      ? []
      : clubs.map((club) => {
          // Only the clubs to validate are checked: the imported ones are the reference.
          const twin = club.validated ? null : likelyDuplicate(club, clubs as AdminClub[]);
          return {
            ...club,
            addedLabel: day.format(new Date(club.createdAt)),
            duplicate: twin
              ? { id: twin.id, name: twin.name, city: twin.city, department: twin.department }
              : null,
          };
        });
  const pending = rows.filter((c) => !c.validated).length;

  return (
    <AdminShell title={text.title} section="clubs" wide>
      <p className="text-sm text-muted-foreground">
        {clubs === "error" ? text.subtitle : text.summary(rows.length, pending)}
      </p>
      <details className="rounded-card border-2 border-dashed border-border p-3.5">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold text-brand dark:text-secondary">
          {text.newClub}
        </summary>
        <div className="mt-3">
          <ClubForm />
        </div>
      </details>
      {clubs === "error" ? (
        <ErrorNotice retryHref="/admin/clubs" message={messages.errors.CLUBS_UNAVAILABLE} />
      ) : (
        <ClubsAdmin clubs={rows} />
      )}
    </AdminShell>
  );
}
