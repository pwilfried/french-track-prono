import type { ErrorCode } from "@/application/errors";
import { SCOPES } from "@/domain/competition";

import { messages } from "../../../messages.fr";
import { adminOnly } from "../../guard";
import { createCompetitionAction } from "../actions";
import { ActionNotice, AdminShell } from "../admin-shell";

const field = "min-h-12 w-full rounded-xl border-2 border-border bg-card px-3.5 text-base";
const TIME_ZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Budapest",
  "Europe/Rome",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
];

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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">{messages.adminCompetitions.type}</legend>
          <div className="grid grid-cols-2 gap-2">
            {SCOPES.map((scope, index) => (
              <label
                key={scope}
                className="flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3.5 font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-ink"
              >
                <input
                  type="radio"
                  name="scope"
                  value={scope}
                  defaultChecked={index === 0}
                  className="size-5 accent-brand"
                />
                {messages.adminCompetitions.scope[scope]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 font-semibold">
          {messages.adminAthletes.name}
          <input name="name" required className={field} />
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <label className="flex flex-col gap-1.5 font-semibold">
            {messages.adminCompetitions.city}
            <input name="city" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 font-semibold">
            {messages.import.country}
            <input name="countryCode" maxLength={3} className={`${field} font-mono uppercase`} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 font-semibold">
            {messages.adminCompetitions.startsOn}
            <input type="date" name="startsOn" required className={field} />
          </label>
          <label className="flex flex-col gap-1.5 font-semibold">
            {messages.adminCompetitions.endsOn}
            <input type="date" name="endsOn" required className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 font-semibold">
          {messages.adminCompetitions.timeZone}
          <select name="timeZone" defaultValue="Europe/Paris" className={field}>
            {TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <span className="text-sm font-normal text-muted-foreground">
            {messages.adminCompetitions.timeZoneHint}
          </span>
        </label>
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
