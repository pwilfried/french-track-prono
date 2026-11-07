import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";

/** Error state with a retry link, shared by the pages that read events. */
export function ErrorNotice({
  retryHref,
  message = messages.errors.EVENTS_UNAVAILABLE,
}: {
  retryHref: string;
  message?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-muted p-4">
      <p>{message}</p>
      <Link href={retryHref} className={buttonVariants({ variant: "outline" })}>
        {messages.errors.retry}
      </Link>
    </div>
  );
}
