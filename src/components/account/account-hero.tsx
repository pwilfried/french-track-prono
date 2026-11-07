import { BrandLink } from "@/components/brand/brand-link";

/** Blue header shared by the account pages (sign-in, welcome). */
export function AccountHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="hero px-4 pb-6 pt-8">
      <div className="mx-auto max-w-md">
        <BrandLink />
        <h1 className="mt-2 font-display text-3xl font-extrabold uppercase leading-none">
          {title}
        </h1>
        <p className="mt-2 text-[#dce6f5]">{subtitle}</p>
      </div>
    </header>
  );
}
