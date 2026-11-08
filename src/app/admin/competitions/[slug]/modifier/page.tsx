import { notFound } from "next/navigation";

import type { ErrorCode } from "@/application/errors";
import { UseCaseError } from "@/application/errors";
import { getCompetitionFile } from "@/application/list-competitions";
import { createSupabaseCompetitionAdminRepository } from "@/infra";

import { messages } from "../../../../messages.fr";
import { adminOnly } from "../../../guard";
import { deleteCompetitionAction, editCompetitionAction } from "../../actions";
import { ActionNotice, AdminShell } from "../../admin-shell";
import { CompetitionFields } from "../../competition-fields";

/** Correct a competition (#293), or delete it while nobody predicted it. */
export default async function EditCompetitionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { client } = await adminOnly();
  const { slug } = await params;
  const { erreur } = await searchParams;
  const error = erreur && erreur in messages.errors ? messages.errors[erreur as ErrorCode] : null;
  let file;
  try {
    file = await getCompetitionFile({
      competitions: createSupabaseCompetitionAdminRepository(client),
    }).execute({ slug });
  } catch (e) {
    if (e instanceof UseCaseError) notFound();
    throw e;
  }
  const t = messages.adminCompetitions;

  return (
    <AdminShell
      title={t.editTitle}
      back={{ href: `/admin/competitions/${slug}`, label: file.name }}
    >
      <ActionNotice saved={false} error={error} />
      <form action={editCompetitionAction} className="flex flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />
        <CompetitionFields initial={file} />
        <button
          type="submit"
          className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground"
        >
          {t.editSubmit}
        </button>
      </form>
      <details className="rounded-card border-2 border-dashed border-border p-3.5">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold">
          {t.deleteTitle}
        </summary>
        <form action={deleteCompetitionAction} className="flex flex-col gap-3 pt-2">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm text-muted-foreground">{t.deleteHint}</p>
          <button
            type="submit"
            className="min-h-12 rounded-full border-2 border-primary font-bold text-accent-text"
          >
            {t.deleteSubmit(file.name)}
          </button>
        </form>
      </details>
    </AdminShell>
  );
}
