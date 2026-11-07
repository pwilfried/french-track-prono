import Image from "next/image";
import Link from "next/link";

import { messages } from "@/app/messages.fr";

/** FrenchTrack logo and the red « Prono » tag, back to the home page. Made for the blue headers. */
export function BrandLink() {
  return (
    <Link
      href="/"
      aria-label={messages.app.home}
      className="inline-flex min-h-11 shrink-0 items-center gap-2"
    >
      <Image
        src="/brand/frenchtrack.png"
        width={274}
        height={318}
        alt=""
        priority
        className="h-12 w-auto"
      />
      <span className="-rotate-3 rounded-lg bg-primary px-2 py-0.5 text-xs font-extrabold uppercase text-primary-foreground">
        {messages.app.nameLine2}
      </span>
    </Link>
  );
}
