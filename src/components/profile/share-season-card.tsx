"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

const text = messages.seasonCard;

/**
 * « Partager ma carte de saison » (#388): the native share sheet when the device can share an
 * image (mobile), a download otherwise.
 */
export function ShareSeasonCard() {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function share() {
    setState("busy");
    try {
      const response = await fetch("/profil/carte");
      if (!response.ok) throw new Error(`season card: ${response.status}`);
      const file = new File([await response.blob()], text.fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: text.shareTitle });
        } catch (error) {
          // Closing the share sheet is not an error.
          if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
        }
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = text.fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
      setState("idle");
    } catch (error) {
      reportError(error, "share-season-card");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={share}
        disabled={state === "busy"}
        className={`${buttonVariants()} w-full`}
      >
        {state === "busy" ? text.preparing : text.share}
      </button>
      {state === "error" && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {text.error}
        </p>
      )}
    </div>
  );
}
