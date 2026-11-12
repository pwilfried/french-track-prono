"use client";

import { useState, useSyncExternalStore } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { codeFromClipboard } from "@/domain/auth";

const noSubscription = () => () => {};
const canReadClipboard = () => typeof navigator.clipboard?.readText === "function";

/**
 * « Coller le code » : reads the clipboard and hands over the six-digit code found there. Hidden
 * when the browser cannot read the clipboard; a refusal or a clipboard without a code only shows
 * a short message, the field stays usable. `readClipboard` replaces the browser's (stories).
 */
export function PasteCodeButton({
  onCode,
  readClipboard,
}: {
  onCode: (code: string) => void;
  readClipboard?: () => Promise<string>;
}) {
  const browserCanRead = useSyncExternalStore(noSubscription, canReadClipboard, () => false);
  const [missing, setMissing] = useState(false);
  if (!readClipboard && !browserCanRead) return null;

  async function paste() {
    let code: string | null = null;
    try {
      code = codeFromClipboard(await (readClipboard ?? (() => navigator.clipboard.readText()))());
    } catch {
      // Permission refused: same answer as an empty clipboard.
    }
    setMissing(code === null);
    if (code) onCode(code);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={paste}
        className={`${buttonVariants({ variant: "outline" })} min-h-11 w-full`}
      >
        {messages.signIn.pasteCode}
      </button>
      {missing ? (
        <p role="status" className="text-sm font-semibold text-accent-text">
          {messages.signIn.noCodeToPaste}
        </p>
      ) : null}
    </div>
  );
}
