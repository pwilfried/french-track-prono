"use client";

import { messages } from "@/app/messages.fr";
import { useInviteShare } from "@/components/leagues/share-invite";

const text = messages.challenge;

/** Shares the verdict of a challenge with the phone's share sheet, or copies the link. */
export function ShareChallenge({
  slug,
  verdict,
  eventName,
}: {
  slug: string;
  verdict: "won" | "lost" | "tie";
  eventName: string;
}) {
  const { copied, share } = useInviteShare({
    path: `/epreuves/${slug}`,
    title: text.title,
    text: text.shareText(verdict, eventName),
  });
  return (
    <>
      <button
        type="button"
        onClick={share}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 font-bold text-nuit hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        {copied ? text.copied : text.share}
      </button>
      <p role="status" className="sr-only">
        {copied ? text.copied : ""}
      </p>
    </>
  );
}
