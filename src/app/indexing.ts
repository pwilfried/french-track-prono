/**
 * Pre-production is public but kept out of search engines (#634): its build sets
 * NEXT_PUBLIC_SITE_NOINDEX=1 (preprod.yml). Read at build time, so static pages follow it too.
 */
export function isIndexed() {
  return process.env.NEXT_PUBLIC_SITE_NOINDEX !== "1";
}

/** The robots meta tag of every page. */
export function robotsMeta() {
  return isIndexed() ? { index: true, follow: true } : { index: false, follow: false };
}
