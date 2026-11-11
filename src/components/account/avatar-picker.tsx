import { messages } from "@/app/messages.fr";
import { AVATARS } from "@/domain/profile";

/** The 12 emoji avatars as big radio tiles. Sends `avatar`. */
export function AvatarPicker({ chosen, error }: { chosen: string; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {messages.welcome.avatarLabel}
      </legend>
      <div className="grid grid-cols-4 gap-2.5">
        {AVATARS.map((avatar) => (
          <label key={avatar} className="cursor-pointer">
            <input
              type="radio"
              name="avatar"
              value={avatar}
              defaultChecked={chosen === avatar}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="grid aspect-square min-h-16 place-items-center rounded-2xl border-2 border-border bg-card text-3xl peer-checked:border-primary peer-checked:bg-muted peer-checked:ring-4 peer-checked:ring-primary/25 peer-focus-visible:ring-4 peer-focus-visible:ring-ring"
            >
              {avatar}
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
