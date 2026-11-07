import Link from "next/link";

import { messages } from "@/app/messages.fr";

const LINKS = [
  { href: "/mentions-legales", label: messages.legal.footer.notice },
  { href: "/confidentialite", label: messages.legal.footer.privacy },
  { href: "/mentions-legales#contact", label: messages.legal.footer.contact },
];

/** Links to the legal pages, at the bottom of every page. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-4 py-2">
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
