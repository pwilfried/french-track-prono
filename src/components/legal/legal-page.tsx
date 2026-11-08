import { AccountHero } from "@/components/account/account-hero";

type Section = { id?: string; heading: string; body: readonly string[] };

/** A legal text: hero, then sections of short paragraphs. */
export function LegalPage({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle: string;
  sections: readonly Section[];
}) {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero title={title} subtitle={subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        {sections.map((section) => (
          <section key={section.heading} id={section.id} className="flex flex-col gap-2">
            <h2 className="text-lg font-extrabold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
