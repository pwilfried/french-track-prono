import { listAdminClubs, type AdminClub } from "@/application/club-admin";
import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabaseClubAdminRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { paramText } from "../../search-params";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { ClubForm } from "./club-forms";
import { ClubList } from "./club-list";

const text = messages.adminClubs;

/** Back-office « Clubs » (#366): search, validate, edit, create and delete clubs. */
export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await adminOnly();
  const params = await searchParams;
  const query = (paramText(params.q) ?? "").trim();
  // With no search, the clubs to validate are what the admin comes for.
  const pendingOnly = paramText(params.avalider) === "1" || query === "";
  let clubs: AdminClub[] | "error";
  try {
    clubs = await listAdminClubs({ clubs: createSupabaseClubAdminRepository(client) }).execute({
      query,
      pendingOnly,
    });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    clubs = "error";
  }

  return (
    <AdminShell title={text.title} section="clubs">
      <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      <form role="search" action="/admin/clubs" className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-bold">{text.searchLabel}</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              maxLength={80}
              autoComplete="off"
              className="min-h-12 rounded-2xl border-2 border-border bg-card px-3.5 text-base focus-visible:border-primary focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 rounded-2xl bg-primary px-4 font-bold text-primary-foreground"
          >
            {text.search}
          </button>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="avalider"
            value="1"
            defaultChecked={pendingOnly}
            className="size-5 accent-primary"
          />
          {text.pendingOnly}
        </label>
      </form>
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
      ) : clubs.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ClubList clubs={clubs} />
      )}
    </AdminShell>
  );
}
