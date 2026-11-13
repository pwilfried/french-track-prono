import type { CompetitionFields as Fields } from "@/application/edit-competition";
import { SCOPES, VENUES } from "@/domain/competition";

import { messages } from "../../messages.fr";

const field = "min-h-12 w-full rounded-xl border-2 border-border bg-card px-3.5 text-base";

/** One choice among a few, as large radio tiles. */
function Choice<T extends string>({
  legend,
  name,
  options,
  labels,
  checked,
}: {
  legend: string;
  name: string;
  options: T[];
  labels: Record<T, string>;
  checked: T;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3.5 font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-ink"
          >
            <input
              type="radio"
              name={name}
              value={option}
              defaultChecked={option === checked}
              className="size-5 accent-brand"
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The fields of a competition, empty for a new one or filled for a correction. */
export function CompetitionFields({ initial }: { initial?: Fields }) {
  return (
    <>
      <Choice
        legend={messages.adminCompetitions.type}
        name="scope"
        options={SCOPES}
        labels={messages.adminCompetitions.scope}
        checked={initial?.scope ?? "international"}
      />
      <Choice
        legend={messages.adminCompetitions.venueLabel}
        name="venue"
        options={VENUES}
        labels={messages.adminCompetitions.venue}
        checked={initial?.venue ?? "outdoor"}
      />
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
    </>
  );
}
