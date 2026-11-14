"use client";

import { useEffect, useRef, useState } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Badge, BadgeLevel } from "@/domain/badges";

const text = messages.profile;

/**
 * The hare celebrates the badge levels won since the last visit (#821), at the top of the profile.
 * Once shown, `onSeen` stores them, so it comes only once. The hop stops with reduced motion.
 */
export function BadgeCelebration({
  raised,
  onSeen,
}: {
  raised: { badge: Badge; level: BadgeLevel }[];
  onSeen: () => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const told = useRef(false);
  useEffect(() => {
    if (raised.length === 0 || told.current) return;
    told.current = true;
    void onSeen();
  }, [raised, onSeen]);

  if (!open || raised.length === 0) return null;
  return (
    <section
      role="status"
      aria-labelledby="badge-celebration"
      className="flex items-start gap-3 rounded-card bg-gold-soft p-4 text-gold-ink"
    >
      <span aria-hidden="true" className="text-4xl motion-safe:animate-hare-hop">
        🐇
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 id="badge-celebration" className="font-display text-lg font-extrabold break-words">
          {text.celebrationTitle}
        </h2>
        <ul className="flex flex-col gap-1 text-sm font-semibold">
          {raised.map((r) => (
            <li key={r.badge} className="break-words">
              <span aria-hidden="true">{messages.badges[r.badge].emoji} </span>
              {text.celebrationLevel(
                messages.badges[r.badge].name,
                messages.badgeLevels.name[r.level],
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "self-start")}
          onClick={() => setOpen(false)}
        >
          {text.celebrationClose}
        </button>
      </div>
    </section>
  );
}
