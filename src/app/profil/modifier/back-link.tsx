"use client";

import { useRouter } from "next/navigation";

/** « ‹ » back to the page the player came from (profile or settings), else to `fallback`. */
export function BackLink({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-3">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
        className="flex min-h-11 items-center gap-1 font-semibold text-primary"
      >
        <span aria-hidden="true">‹</span>
        {label}
      </button>
    </div>
  );
}
