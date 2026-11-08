/** Header of the account pages (sign-in, welcome, profile), on the cream page. */
export function AccountHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="px-4 pb-2 pt-6">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-extrabold leading-none">{title}</h1>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
    </header>
  );
}
