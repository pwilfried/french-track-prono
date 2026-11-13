"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { messages } from "@/app/messages.fr";

/**
 * A bottom sheet over the page (#659, #661), in a modal dialog: the browser keeps the focus inside,
 * Escape closes it, and so do its « Fermer » button and a touch outside. `header` sits under the
 * title (search, filters, tabs); `children` scroll below it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal?.();
    if (!open && element.open) element.close?.();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        // Handled here so that the browser's own cancel does not close it behind React's back.
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={(event) => {
        // A touch on the backdrop lands on the dialog itself, outside the sheet.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-black/50 md:mx-auto md:mb-auto md:max-w-lg md:rounded-3xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl font-extrabold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold"
            >
              {messages.competitions.sheet.close}
            </button>
          </div>
          {header}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">{children}</div>
      </div>
    </dialog>
  );
}
