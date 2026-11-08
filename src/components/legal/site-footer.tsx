import Link from "next/link";

import { messages } from "@/app/messages.fr";

const text = messages.legal.footer;

const LINKS = [
  { href: "/mentions-legales", label: text.notice },
  { href: "/confidentialite", label: text.privacy },
  { href: "/mentions-legales#contact", label: text.contact },
];

/** FrenchTrack's accounts (issue #313), without tracking parameters. */
const SOCIAL = [
  { href: "https://www.instagram.com/frenchtrack", label: text.social.instagram },
  { href: "https://www.youtube.com/@French_Track", label: text.social.youtube },
  { href: "https://www.tiktok.com/@french.track", label: text.social.tiktok },
  { href: "https://podcastics.com/podcast/french-track", label: text.social.podcast },
];

/** FrenchTrack's accounts, then the links to the legal pages, at the bottom of every page. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-2">
      <nav aria-label={text.socialLabel}>
        <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-x-4 text-sm font-semibold">
          {SOCIAL.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={text.opensNewTab(link.label)}
                className="flex min-h-11 items-center text-foreground hover:underline hover:underline-offset-4"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-x-4 text-sm">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-11 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
