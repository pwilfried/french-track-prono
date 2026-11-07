import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

import { messages } from "./messages.fr";

const steps = [
  { rank: 2, height: "h-16", style: "bg-[#c9ced8] text-nuit" },
  { rank: 1, height: "h-24", style: "bg-secondary text-secondary-foreground" },
  { rank: 3, height: "h-12", style: "bg-primary text-primary-foreground" },
] as const;

export default function Home() {
  return (
    <main id="main" className="hero flex flex-1 flex-col px-4 pb-10 pt-6">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="flex flex-col items-center font-display text-5xl font-extrabold uppercase leading-none tracking-tight">
          <Image
            src="/brand/frenchtrack-dark.png"
            width={274}
            height={318}
            alt={messages.app.logoAlt}
            priority
            className="h-40 w-auto"
          />
          <span className="mt-3 block">
            <span className="inline-block -rotate-2 rounded-xl bg-primary px-4 py-1 text-primary-foreground">
              {messages.app.nameLine2}
            </span>
          </span>
        </h1>
        <p className="text-lg text-[#dce6f5]">{messages.app.tagline}</p>

        <div
          role="img"
          aria-label={messages.home.podiumLabel}
          className="flex items-end justify-center gap-2"
        >
          {steps.map((step) => (
            <div
              key={step.rank}
              className={`flex w-20 items-start justify-center rounded-t-2xl pt-2 text-2xl font-extrabold ${step.height} ${step.style}`}
            >
              {step.rank}
            </div>
          ))}
        </div>

        <Link href="/epreuves" className={buttonVariants({ size: "lg" })}>
          {messages.home.cta}
        </Link>
      </div>
    </main>
  );
}
