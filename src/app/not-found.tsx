import type { Metadata } from "next";
import Link from "next/link";

import { AccountHero } from "@/components/account/account-hero";
import { buttonVariants } from "@/components/ui/button";

import { messages } from "./messages.fr";

const text = messages.notFound;

export const metadata: Metadata = { title: text.title };

/** Unknown addresses and `notFound()` calls land here, in French, with the 404 status kept (#982). */
export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero title={text.title} subtitle={text.body} />
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <Link href="/" className={`${buttonVariants()} w-full`}>
          {text.home}
        </Link>
      </div>
    </main>
  );
}
