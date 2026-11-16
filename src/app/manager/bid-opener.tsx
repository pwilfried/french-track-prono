import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { ChipStatus } from "@/components/ui/chip-status";

const text = messages.catalogue;

/**
 * The folded bid of one catalogue card (#503): the current bid, if any, and the button that opens
 * the form. The button names its athlete, so the 60 of the catalogue can be told apart (#983).
 */
export function BidOpener({
  name,
  current,
  onOpen,
}: {
  name: string;
  current: number | null;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {current !== null && (
        <ChipStatus tone="brand" className="justify-center">
          {text.myBid(current)}
        </ChipStatus>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={current !== null ? text.changeOn(name) : text.bidOn(name)}
        className={`${buttonVariants({ variant: current !== null ? "outline" : "default" })} w-full px-3 text-sm`}
      >
        {current !== null ? text.change : text.bid}
      </button>
    </div>
  );
}
