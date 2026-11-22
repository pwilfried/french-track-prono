import { messages } from "../../messages.fr";

/** Before the lock, saving a result locks the event at once (#1063): the admin is told first. */
export function LockWarning() {
  return (
    <p
      role="note"
      className="rounded-card border-2 border-accent-text bg-card p-4 text-sm font-semibold text-accent-text"
    >
      {messages.admin.lockOnSave}
    </p>
  );
}
