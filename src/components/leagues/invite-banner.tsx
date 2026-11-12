"use client";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import { formatInviteCode } from "@/domain/league";

import { useInviteShare } from "./share-invite";

const text = messages.leagues;

/**
 * Shown in a league where the player is still alone (#552): one big button shares the invite link
 * (or copies it), the code stays readable underneath for friends told out loud.
 */
export function InviteBanner({ code, leagueName }: { code: string; leagueName: string }) {
  const { copied, share } = useInviteShare({
    path: `/rejoindre/${code}`,
    title: leagueName,
    text: text.shareText(leagueName),
  });
  return (
    <section
      aria-labelledby="invite-banner-title"
      className="flex flex-col gap-3 rounded-card bg-brand-soft p-4 text-brand-ink"
    >
      <h2 id="invite-banner-title" className="font-display text-xl font-extrabold">
        {text.aloneTitle}
      </h2>
      <p className="text-sm">{text.aloneText}</p>
      <button type="button" onClick={share} className={`${buttonVariants({ size: "lg" })} w-full`}>
        {text.inviteFriends}
      </button>
      <p role="status" className="text-center text-sm font-semibold empty:hidden">
        {copied ? text.linkCopied : ""}
      </p>
      <p className="text-center text-sm">{text.orGiveCode(formatInviteCode(code))}</p>
    </section>
  );
}
