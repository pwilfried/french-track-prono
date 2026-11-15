import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { ChipStatus } from "@/components/ui/chip-status";
import type { Announcement } from "@/domain/community";
import { cn } from "@/lib/utils";

const text = messages.community.announcement;

const pill =
  "inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";

/** The link of an announcement: an https address opens a new tab, a page of the app stays here. */
export function AnnouncementLink({
  link,
  label,
  className,
}: {
  link: string;
  label: string;
  className: string;
}) {
  if (link.startsWith("/")) {
    return (
      <Link href={link} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={messages.legal.footer.opensNewTab(label)}
      className={className}
    >
      {label}
    </a>
  );
}

/**
 * An announcement of FrenchTrack (#673): its kind, a short title and subtitle typed by the admin,
 * a link. A new episode is a night-blue card with « Écouter l'épisode ».
 */
export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const { kind, title, subtitle, link } = announcement;
  if (kind === "episode") {
    return (
      <article className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-nuit p-4 text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d9e4f5]">
          <span aria-hidden>{text.emoji.episode}</span>
          {text.label.episode}
        </p>
        <h3 className="font-display text-lg font-extrabold leading-tight break-words">{title}</h3>
        {subtitle && <p className="text-sm break-words text-[#d9e4f5]">{subtitle}</p>}
        {link && (
          <AnnouncementLink
            link={link}
            label={text.listen}
            className={cn(pill, "bg-white text-nuit hover:bg-white/90")}
          />
        )}
      </article>
    );
  }
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <span
        aria-hidden
        className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-xl"
      >
        {text.emoji[kind]}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <ChipStatus tone="brand" className="self-start">
          {text.label[kind]}
        </ChipStatus>
        <h3 className="font-bold leading-tight break-words">{title}</h3>
        {subtitle && <p className="text-sm break-words text-muted-foreground">{subtitle}</p>}
        {link && (
          <AnnouncementLink
            link={link}
            label={text.see}
            className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
          />
        )}
      </div>
    </article>
  );
}
