import { Button } from "@/components/ui/button";

import { messages } from "./messages.fr";

const steps = [
  { rank: 2, height: "h-16", color: "bg-[#c9ced8]" },
  { rank: 1, height: "h-24", color: "bg-secondary" },
  { rank: 3, height: "h-12", color: "bg-primary" },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="lanes px-4 pb-10 pt-14">
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
          <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight">
            French Track <span className="text-accent-text">Prono</span>
          </h1>
          <p className="text-lg text-muted-foreground">{messages.app.tagline}</p>

          <div
            role="img"
            aria-label={messages.home.podiumLabel}
            className="flex items-end justify-center gap-2"
          >
            {steps.map((step) => (
              <div
                key={step.rank}
                className={`flex w-20 items-start justify-center rounded-t-2xl pt-2 text-2xl font-extrabold text-secondary-foreground ${step.height} ${step.color}`}
              >
                {step.rank}
              </div>
            ))}
          </div>

          <Button size="lg" disabled>
            {messages.home.cta}
          </Button>
          <p className="text-sm text-muted-foreground">{messages.home.soon}</p>
        </div>
      </header>
    </main>
  );
}
