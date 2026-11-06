import Link from "next/link";

import { messages } from "@/app/messages.fr";

/** Blue header shared by the account pages (sign-in, welcome). */
export function AccountHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="hero px-4 pb-6 pt-8">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-3 text-sm font-bold uppercase"
        >
          <span className="-rotate-3 rounded-lg bg-primary px-2.5 py-1 text-primary-foreground">
            {messages.app.short}
          </span>
          {messages.app.name}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none">
          {title}
        </h1>
        <p className="mt-2 text-[#dce6f5]">{subtitle}</p>
      </div>
    </header>
  );
}
