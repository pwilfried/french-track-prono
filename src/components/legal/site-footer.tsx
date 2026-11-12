import Link from "next/link";

import { messages } from "@/app/messages.fr";

import { FRENCHTRACK_ACCOUNTS, SocialIcon } from "./social-icons";

const text = messages.legal.footer;

const LINKS = [
  { href: "/mentions-legales", label: text.notice },
  { href: "/confidentialite", label: text.privacy },
];

const SMALL_LINK =
  "flex min-h-11 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground";

/** FrenchTrack's accounts, then the links to the legal pages and an e-mail to write to us. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-2">
      <nav aria-label={text.socialLabel}>
        <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-x-4 text-sm font-semibold">
          {FRENCHTRACK_ACCOUNTS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={text.opensNewTab(link.label)}
                className="flex min-h-11 items-center gap-1.5 text-foreground hover:underline hover:underline-offset-4"
              >
                <SocialIcon name={link.icon} />
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="mx-auto flex max-w-md flex-wrap justify-center gap-x-4 text-sm">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={SMALL_LINK}>
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <a href={text.contactHref} className={SMALL_LINK}>
            {text.contact}
          </a>
        </li>
      </ul>
    </footer>
  );
}
