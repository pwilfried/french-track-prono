import { redirect } from "next/navigation";

import { paramList } from "../../../search-params";

/**
 * The old choice of competitions, by kind: league creation now has the season picker (#721). An
 * old link opens it with the competitions it ticked.
 */
export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string | string[] }>;
}) {
  const slugs = paramList((await searchParams).competition);
  const query = new URLSearchParams(slugs.map((slug) => ["competition", slug])).toString();
  redirect(query ? `/ligues/creer?${query}` : "/ligues/creer");
}
