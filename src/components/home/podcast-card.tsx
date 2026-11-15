import { messages } from "@/app/messages.fr";
import { AnnouncementLink } from "@/components/community/announcement-card";
import { FRENCHTRACK_ACCOUNTS, SocialIcon } from "@/components/legal/social-icons";
import type { Announcement } from "@/domain/community";

const text = messages.playerHome.frenchTrack;
const announcement = messages.community.announcement;
const footer = messages.legal.footer;

const PODCAST = FRENCHTRACK_ACCOUNTS.find((account) => account.icon === "podcast")!;
const SOCIAL = FRENCHTRACK_ACCOUNTS.filter((account) => account !== PODCAST);

const listen =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 font-bold text-nuit hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";

/**
 * « Le podcast FrenchTrack » on the night blue (#478, #711): the latest episode announced by the
 * admin when there is one (#896), else the podcast's page; then FrenchTrack's accounts, which the
 * footer of the home leaves out. The one « Écouter » button of the home.
 */
export function PodcastCard({ episode }: { episode: Announcement | null }) {
  return (
    <section
      aria-labelledby="frenchtrack"
      data-podcast-card
      className="flex flex-col gap-3 rounded-card border border-white/15 bg-nuit p-4 text-white"
    >
      <h2 id="frenchtrack" className="font-display text-xl font-extrabold">
        {text.title}
      </h2>
      {episode ? (
        <>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#d9e4f5]">
            <span aria-hidden>{announcement.emoji.episode}</span>
            {announcement.label.episode}
          </p>
          <h3 className="font-display text-lg font-extrabold leading-tight break-words">
            {episode.title}
          </h3>
          {episode.subtitle && (
            <p className="text-sm break-words text-[#d9e4f5]">{episode.subtitle}</p>
          )}
          <AnnouncementLink
            link={episode.link ?? PODCAST.href}
            label={announcement.listen}
            className={listen}
          />
        </>
      ) : (
        <>
          <p className="text-sm text-[#d9e4f5]">{text.text}</p>
          <a
            href={PODCAST.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={footer.opensNewTab(text.listen)}
            className={listen}
          >
            <SocialIcon name="podcast" />
            {text.listen}
          </a>
        </>
      )}
      <ul
        aria-label={footer.socialLabel}
        data-social-links="home"
        className="grid grid-cols-3 gap-2"
      >
        {SOCIAL.map((account) => (
          <li key={account.href}>
            <a
              href={account.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={footer.opensNewTab(account.label)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/40 px-2 text-sm font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            >
              <SocialIcon name={account.icon} />
              {account.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
