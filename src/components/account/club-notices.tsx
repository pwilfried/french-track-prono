import { dismissClubNoticeAction } from "@/app/club-notice-actions";
import { messages } from "@/app/messages.fr";
import type { ClubNotice } from "@/application/club-notices";

const text = messages.clubNotices;

/** What the admin did to the player's club, shown until the player closes it (#372). */
export function ClubNotices({ notices }: { notices: ClubNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {notices.map((notice) => (
        <li
          key={notice.id}
          role="status"
          className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5"
        >
          <span aria-hidden className="text-xl">
            {notice.kind === "removed" ? "ℹ️" : "✅"}
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">
            {notice.kind === "validated"
              ? text.validated(notice.clubName)
              : notice.kind === "renamed"
                ? text.renamed(notice.clubName, notice.newName ?? "")
                : text.removed(notice.clubName)}
          </p>
          <form action={dismissClubNoticeAction}>
            <input type="hidden" name="id" value={notice.id} />
            <button
              type="submit"
              className="min-h-11 rounded-full border-2 border-border px-4 text-sm font-bold"
            >
              {text.dismiss}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
