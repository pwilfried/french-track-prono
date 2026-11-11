"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { formatInviteCode } from "@/domain/league";
import { reportError } from "@/lib/report-error";

/**
 * The invite code, big and easy to read, with the phone's share sheet for the link (when the
 * browser has one) and a copy button as the fallback.
 */
export function ShareInvite({
  code,
  leagueName,
  path = `/rejoindre/${code}`,
  shareText = messages.leagues.shareText(leagueName),
}: {
  code: string;
  leagueName: string;
  /** Where the link leads: the prediction leagues by default, `/manager/rejoindre…` for Manager. */
  path?: string;
  shareText?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = () => `${window.location.origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: leagueName,
          text: shareText,
          url: link(),
        });
        return;
      } catch (error) {
        // Cancelled by the player: nothing to do (not reported either).
        reportError(error, "share-invite");
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-card border-2 border-dashed border-primary bg-card p-4 text-center">
        <span className="block text-sm text-muted-foreground">{messages.leagues.codeCaption}</span>
        <span className="block font-mono text-4xl font-extrabold tracking-[0.25em]">
          {formatInviteCode(code)}
        </span>
        <span className="block text-sm text-muted-foreground">{messages.leagues.codeNote}</span>
      </p>
      <button type="button" onClick={share} className={`${buttonVariants()} w-full`}>
        {messages.leagues.share}
      </button>
      <button
        type="button"
        onClick={copy}
        className={`${buttonVariants({ variant: "muted" })} w-full`}
      >
        {copied ? messages.leagues.copied : messages.leagues.copy}
      </button>
      <p role="status" className="sr-only">
        {copied ? messages.leagues.copied : ""}
      </p>
      <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
        {messages.leagues.linkNote}
      </p>
    </div>
  );
}
