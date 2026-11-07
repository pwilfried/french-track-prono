import { cn } from "@/lib/utils";

/**
 * Header of the athlete public page (route /athletes/[slug] in v0.5).
 * Photo or emoji avatar + name + country flag + gender. Keeps the gradient surface
 * used for the player profile so the two pages share the brand hierarchy.
 */
export function AthleteHero({
  name,
  flag,
  country,
  gender,
  avatar = "🏃",
  photoUrl,
  className,
}: {
  name: string;
  /** Emoji flag (unicode "🇺🇸", "🇫🇷"...). */
  flag: string;
  country: string;
  gender: "F" | "M" | "X";
  /** Fallback emoji when no photoUrl. */
  avatar?: string;
  photoUrl?: string;
  className?: string;
}) {
  const genderLabel = { F: "Femme", M: "Homme", X: "Mixte" }[gender];

  return (
    <header
      className={cn(
        "flex items-center gap-3.5 bg-gradient-to-b from-[color-mix(in_oklab,var(--color-brand)_14%,transparent)] to-transparent px-4 py-4",
        className,
      )}
    >
      <div className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-[2.5px] border-brand bg-card text-3xl leading-none">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <span aria-hidden="true">{avatar}</span>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-foreground">
          {name}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold text-foreground/80">
          <span className="text-lg leading-none" aria-hidden="true">
            {flag}
          </span>
          <span>{country}</span>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <span>{genderLabel}</span>
        </p>
      </div>
    </header>
  );
}
