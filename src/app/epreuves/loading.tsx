import { messages } from "../messages.fr";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col" aria-busy="true">
      <div className="hero h-40" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 py-5">
        <p className="sr-only" role="status">
          {messages.events.loading}
        </p>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-card bg-muted" />
        ))}
      </div>
    </main>
  );
}
