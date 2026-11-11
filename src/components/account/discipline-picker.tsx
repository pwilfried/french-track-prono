import type { Discipline, DisciplineFamily } from "@/domain/discipline";
import { messages } from "@/app/messages.fr";

/** Disciplines the player practises, ticked by family (#340). Sends `discipline` values. */
export function DisciplinePicker({
  disciplines,
  chosen,
}: {
  disciplines: Pick<Discipline, "name" | "family">[];
  chosen: string[];
}) {
  const families: { family: DisciplineFamily; names: string[] }[] = [];
  for (const discipline of disciplines) {
    if (discipline.family === "relay") continue; // nobody practises only a relay
    const group = families.find((f) => f.family === discipline.family);
    if (group) group.names.push(discipline.name);
    else families.push({ family: discipline.family, names: [discipline.name] });
  }
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {messages.welcome.disciplinesLabel}
      </legend>
      <p className="-mt-1 text-sm text-muted-foreground">{messages.welcome.disciplinesHint}</p>
      {families.map(({ family, names }) => (
        <div
          key={family}
          role="group"
          aria-labelledby={`family-${family}`}
          className="flex flex-col gap-2"
        >
          <span id={`family-${family}`} className="font-bold">
            {messages.disciplines.family[family]}
          </span>
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <label key={name} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="discipline"
                  value={name}
                  defaultChecked={chosen.includes(name)}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring">
                  {name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
