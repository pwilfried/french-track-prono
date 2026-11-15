"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import { Animal } from "@/components/band/animal";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ANIMALS } from "@/domain/band";
import { cn } from "@/lib/utils";

const text = messages.profile.help;

/**
 * « C'est quoi ? » under the player's animal (#940): a sheet over the profile that says where the
 * animal comes from and how the badges are won, so the player never leaves the page.
 */
export function ProfileHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={text.openLabel}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4",
          className,
        )}
      >
        {text.open}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={text.title}>
        <div className="flex flex-col gap-4 text-sm">
          <section aria-labelledby="help-animal" className="flex flex-col gap-2">
            <h3 id="help-animal" className="font-display text-base font-extrabold">
              {text.animalTitle}
            </h3>
            <p>{text.animal}</p>
            <ul className="grid grid-cols-1 gap-1.5">
              {ANIMALS.map((animal) => (
                <li key={animal} className="flex min-w-0 items-center gap-3">
                  <Animal kind={animal} className="size-9" />
                  <span className="min-w-0 break-words">
                    <strong>{messages.band.animals[animal]}</strong> ·{" "}
                    {messages.band.families[animal]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="help-badges" className="flex flex-col gap-2">
            <h3 id="help-badges" className="font-display text-base font-extrabold">
              {text.badgesTitle}
            </h3>
            <p>{text.badges}</p>
            <p>{text.next}</p>
          </section>
        </div>
      </BottomSheet>
    </>
  );
}
