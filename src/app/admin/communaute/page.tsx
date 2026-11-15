import type { Announcement, Poll } from "@/domain/community";
import { UseCaseError } from "@/application/errors";
import { SubmitButton } from "@/components/account/submit-button";
import { ErrorNotice } from "@/components/error-notice";
import { pollResults } from "@/domain/community";
import { createSupabaseCommunityRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { removeCommunityItemAction } from "./actions";
import { AnnouncementForm, PollForm } from "./community-forms";

const text = messages.adminCommunity;
const box = "flex flex-col gap-3 rounded-card border border-border bg-card p-3";
const heading = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

function RemoveButton({
  id,
  type,
  title,
}: {
  id: string;
  type: "poll" | "announcement";
  title: string;
}) {
  return (
    <form action={removeCommunityItemAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="type" value={type} />
      <SubmitButton
        pendingLabel={text.removing}
        variant="outline"
        className="w-auto"
        ariaLabel={text.removeLabel(title)}
      >
        {text.remove}
      </SubmitButton>
    </form>
  );
}

/** The announcements and polls of the community block (#673): publish, follow, remove. */
export default async function AdminCommunityPage() {
  const { client } = await adminOnly();
  const community = createSupabaseCommunityRepository(client);
  let online: { announcements: Announcement[]; polls: Poll[] } | "error";
  try {
    const [announcements, polls] = await Promise.all([
      community.announcements(),
      community.polls(),
    ]);
    online = { announcements, polls };
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    online = "error";
  }

  return (
    <AdminShell title={text.title} section="community">
      <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      <section aria-labelledby="announcement-form" className={box}>
        <h2 id="announcement-form" className={heading}>
          {text.announcementTitle}
        </h2>
        <AnnouncementForm />
      </section>
      <section aria-labelledby="poll-form" className={box}>
        <h2 id="poll-form" className={heading}>
          {text.pollTitle}
        </h2>
        <PollForm />
      </section>
      <section aria-labelledby="online" className={box}>
        <h2 id="online" className={heading}>
          {text.listTitle}
        </h2>
        {online === "error" ? (
          <ErrorNotice
            retryHref="/admin/communaute"
            message={messages.errors.COMMUNITY_UNAVAILABLE}
          />
        ) : online.announcements.length + online.polls.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {online.polls.map((poll) => (
              <li
                key={poll.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2"
              >
                <span className="min-w-0 break-words text-sm">
                  <strong className="block">{poll.question}</strong>
                  {messages.community.poll.label} ·{" "}
                  {text.pollSummary(pollResults(poll.votes ?? []).total)} ·{" "}
                  {messages.community.poll.closesAt(poll.closesAt)}
                </span>
                <RemoveButton id={poll.id} type="poll" title={poll.question} />
              </li>
            ))}
            {online.announcements.map((announcement) => (
              <li
                key={announcement.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2"
              >
                <span className="min-w-0 break-words text-sm">
                  <strong className="block">{announcement.title}</strong>
                  {messages.community.announcement.label[announcement.kind]}
                </span>
                <RemoveButton id={announcement.id} type="announcement" title={announcement.title} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
