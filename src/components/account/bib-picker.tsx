"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import {
  BIB_COLORS,
  DEFAULT_BIB,
  isBibColor,
  validateBib,
  type Bib as BibValue,
} from "@/domain/bib";
import { Bib, BIB_PALETTE } from "@/components/profile/bib";

import { Field } from "./field";

const validNumber = (text: string): number | null => {
  const result = validateBib(text, DEFAULT_BIB.color);
  return result.ok ? result.bib.number : null;
};

/**
 * Choice of the bib (#537): the number on the numeric keypad, six colour swatches, and the large
 * bib as a preview. Sends `bibNumber` and `bibColor`.
 */
export function BibPicker({
  chosen,
  pseudo,
  numberError,
  colorError,
}: {
  /** As last sent: the number as typed, the colour code. */
  chosen: { number: string; color: string };
  /** Printed on the preview. */
  pseudo?: string;
  numberError?: string;
  colorError?: string;
}) {
  const [number, setNumber] = useState(chosen.number);
  const [color, setColor] = useState(chosen.color);
  // While the number is being typed (or wrong), the preview keeps the last valid one.
  const [shownNumber, setShownNumber] = useState(() => validNumber(chosen.number) ?? 0);
  const preview: BibValue = {
    number: shownNumber,
    color: isBibColor(color) ? color : DEFAULT_BIB.color,
  };

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {messages.bib.legend}
      </legend>
      <div className="flex justify-center" aria-live="polite">
        <Bib bib={preview} size="large" pseudo={pseudo} />
      </div>
      <Field
        id="bibNumber"
        name="bibNumber"
        label={messages.bib.numberLabel}
        hint={messages.bib.numberHint}
        error={numberError}
        value={number}
        onChange={(event) => {
          setNumber(event.target.value);
          const valid = validNumber(event.target.value);
          if (valid !== null) setShownNumber(valid);
        }}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        autoComplete="off"
        className="font-display text-xl font-extrabold tabular-nums"
      />
      <div className="flex flex-col gap-2">
        <span id="bibColor-label" className="text-sm font-bold">
          {messages.bib.colorLabel}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="bibColor-label"
          aria-describedby={colorError ? "bibColor-error" : undefined}
          className="grid grid-cols-6 gap-2"
        >
          {BIB_COLORS.map((code) => (
            <label key={code} className="cursor-pointer">
              <input
                type="radio"
                name="bibColor"
                value={code}
                checked={color === code}
                onChange={() => setColor(code)}
                aria-label={messages.bib.colors[code]}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                style={{
                  backgroundColor: BIB_PALETTE[code].background,
                  borderColor: BIB_PALETTE[code].border,
                }}
                className="block aspect-square min-h-11 rounded-xl border-2 peer-checked:ring-4 peer-checked:ring-primary peer-checked:ring-offset-2 peer-checked:ring-offset-background peer-focus-visible:ring-4 peer-focus-visible:ring-ring"
              />
            </label>
          ))}
        </div>
        {colorError ? (
          <p id="bibColor-error" role="alert" className="text-sm font-semibold text-accent-text">
            {colorError}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
