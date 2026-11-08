import Link from "next/link";

import { messages } from "@/app/messages.fr";

/**
 * FrenchTrack logo back to the home page: the solid version on the cream page, the outlined one
 * in dark mode (white letters on navy).
 */
export function BrandLink() {
  return (
    <Link
      href="/"
      aria-label={messages.app.home}
      className="inline-flex min-h-11 shrink-0 items-center"
    >
      <picture>
        <source srcSet="/brand/frenchtrack-dark.png" media="(prefers-color-scheme: dark)" />
        <img
          src="/brand/frenchtrack-light.png"
          alt=""
          width={272}
          height={315}
          className="h-10 w-auto"
        />
      </picture>
    </Link>
  );
}
