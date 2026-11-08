import type { ErrorCode } from "@/application/errors";

import { messages } from "../../../messages.fr";
import { adminOnly } from "../../guard";
import { createCompetitionAction } from "../actions";
import { ActionNotice, AdminShell } from "../admin-shell";
import { CompetitionFields } from "../competition-fields";

export default async function NewCompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  await adminOnly();
  const { erreur } = await searchParams;
  const error = erreur && erreur in messages.errors ? messages.errors[erreur as ErrorCode] : null;

  return (
    <AdminShell
      title={messages.adminCompetitions.newTitle}
      back={{ href: "/admin/competitions", label: messages.adminCompetitions.title }}
    >
      <ActionNotice saved={false} error={error} />
      <form action={createCompetitionAction} className="flex flex-col gap-4">
        <CompetitionFields />
        <button
          type="submit"
          className="min-h-12 rounded-full bg-primary font-bold text-primary-foreground"
        >
          {messages.adminCompetitions.createSubmit}
        </button>
      </form>
    </AdminShell>
  );
}
