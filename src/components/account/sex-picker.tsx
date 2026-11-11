import { messages } from "@/app/messages.fr";

const SEXES = [
  { value: "F", label: messages.welcome.sexF },
  { value: "M", label: messages.welcome.sexM },
  { value: "", label: messages.welcome.sexNone },
];

/** Femme, Homme or « Je préfère ne pas le dire » (#340). Sends `sex`. */
export function SexPicker({ chosen, error }: { chosen: string; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {messages.welcome.sexLabel}
      </legend>
      <div className="flex flex-wrap gap-2">
        {SEXES.map((sex) => (
          <label key={sex.value} className="cursor-pointer">
            <input
              type="radio"
              name="sex"
              value={sex.value}
              defaultChecked={chosen === sex.value}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-4 text-sm font-semibold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-4 peer-focus-visible:ring-ring">
              {sex.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
