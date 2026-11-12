import { messages } from "@/app/messages.fr";
import type { Bib as BibValue, BibColor } from "@/domain/bib";
import { cn } from "@/lib/utils";

/**
 * Background, text and border of each bib colour (#537). Fixed colours, the same in both themes:
 * a bib is a physical object. Every background/text pair passes AA (blue/white 9.1:1,
 * red/white 4.55:1, gold/night 9:1, green/night 5.3:1, white/night 13:1, night/gold 9:1).
 * Exported for the season card image, which cannot use CSS classes.
 */
export const BIB_PALETTE: Record<BibColor, { background: string; text: string; border: string }> = {
  blue: { background: "#084595", text: "#FFFFFF", border: "#084595" },
  red: { background: "#E03020", text: "#FFFFFF", border: "#E03020" },
  gold: { background: "#FFC857", text: "#052B5C", border: "#E5AC3A" },
  green: { background: "#2BB673", text: "#052B5C", border: "#229A60" },
  white: { background: "#FFFFFF", text: "#052B5C", border: "#B8C2D3" },
  night: { background: "#052B5C", text: "#FFC857", border: "#FFC857" },
};

const PIN_CORNERS = ["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"];

/**
 * The player's bib, the one avatar of the app. `small`: a rectangular chip with the number alone
 * (rankings, header, leagues, reactions), decorative since the pseudo sits next to it. `large`:
 * the full bib with four pins, « FRENCH TRACK », the number and the pseudo (profile, choice).
 */
export function Bib({
  bib,
  size = "small",
  pseudo,
  className = "",
}: {
  bib: BibValue;
  size?: "small" | "large";
  /** Printed under the number on the large bib. */
  pseudo?: string;
  className?: string;
}) {
  const palette = BIB_PALETTE[bib.color];
  const colours = {
    backgroundColor: palette.background,
    color: palette.text,
    borderColor: palette.border,
  };

  if (size === "small") {
    return (
      <span
        aria-hidden="true"
        data-bib-color={bib.color}
        style={colours}
        className={cn(
          "inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-md border px-1.5 font-display text-sm font-extrabold leading-none tabular-nums",
          className,
        )}
      >
        {bib.number}
      </span>
    );
  }

  return (
    <div
      role="img"
      aria-label={
        pseudo ? `${messages.bib.label(bib.number)}, ${pseudo}` : messages.bib.label(bib.number)
      }
      data-bib-color={bib.color}
      style={colours}
      className={cn(
        "relative flex aspect-[4/3] w-full max-w-60 flex-col items-center justify-between rounded-2xl border-2 px-6 py-4 shadow-md",
        className,
      )}
    >
      {PIN_CORNERS.map((corner) => (
        <span
          key={corner}
          aria-hidden="true"
          className={`absolute ${corner} size-2.5 rounded-full border border-black/30 bg-[#D5DAE1] shadow-inner`}
        />
      ))}
      <span aria-hidden="true" className="text-[0.65rem] font-bold uppercase tracking-[0.3em]">
        {messages.bib.brand}
      </span>
      <span
        aria-hidden="true"
        className="font-display text-7xl font-extrabold leading-none tabular-nums"
      >
        {bib.number}
      </span>
      <span aria-hidden="true" className="max-w-full truncate text-sm font-bold">
        {pseudo ?? " "}
      </span>
    </div>
  );
}
