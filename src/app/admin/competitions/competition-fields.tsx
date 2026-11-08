import type { CompetitionFields as Fields } from "@/application/edit-competition";
import { SCOPES } from "@/domain/competition";

import { messages } from "../../messages.fr";

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

/** The fields of a competition, empty for a new one or filled for a correction. */
export function CompetitionFields({ initial }: { initial?: Fields }) {
  const zones =
    initial && !TIME_ZONES.includes(initial.timeZone)
      ? [initial.timeZone, ...TIME_ZONES]
      : TIME_ZONES;
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{messages.adminCompetitions.type}</legend>
        <div className="grid grid-cols-2 gap-2">
          {SCOPES.map((scope) => (
            <label
              key={scope}
              className="flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3.5 font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-ink"
            >
              <input
                type="radio"
                name="scope"
                value={scope}
                defaultChecked={scope === (initial?.scope ?? SCOPES[0])}
                className="size-5 accent-brand"
              />
              {messages.adminCompetitions.scope[scope]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 font-semibold">
        {messages.adminAthletes.name}
        <input name="name" required defaultValue={initial?.name} className={field} />
      </label>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="flex flex-col gap-1.5 font-semibold">
          {messages.adminCompetitions.city}
          <input name="city" defaultValue={initial?.city ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">
          {messages.import.country}
          <input
            name="countryCode"
            defaultValue={initial?.countryCode ?? ""}
            maxLength={3}
            className={`${field} font-mono uppercase`}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 font-semibold">
          {messages.adminCompetitions.startsOn}
          <input
            type="date"
            name="startsOn"
            required
            defaultValue={initial?.startsOn}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">
          {messages.adminCompetitions.endsOn}
          <input
            type="date"
            name="endsOn"
            required
            defaultValue={initial?.endsOn}
            className={field}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 font-semibold">
        {messages.adminCompetitions.timeZone}
        <select
          name="timeZone"
          defaultValue={initial?.timeZone ?? "Europe/Paris"}
          className={field}
        >
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <span className="text-sm font-normal text-muted-foreground">
          {messages.adminCompetitions.timeZoneHint}
        </span>
      </label>
    </>
  );
}
