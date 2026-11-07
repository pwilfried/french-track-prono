import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

import { messages } from "../../messages.fr";

export default function EventNotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-4 px-4 py-8"
    >
      <p role="alert" className="rounded-card bg-muted p-4">
        {messages.errors.EVENT_NOT_FOUND}
      </p>
      <Link href="/epreuves" className={buttonVariants({ variant: "outline" })}>
        {messages.event.back}
      </Link>
    </main>
  );
}
