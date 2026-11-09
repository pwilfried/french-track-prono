/**
 * Words a name shown to other players may not contain (moderation decided by the owner, #277 and
 * #278): common insults, names that would look official, and links. Used for public league names,
 * pseudos and clubs typed by hand. Whole words; stems also cover their endings ("officielle",
 * "enculés"). The database keeps the same list (is_banned_name).
 */
const BANNED_WORDS = [
  "con",
  "cons",
  "pd",
  "fdp",
  "ntm",
  "ffa",
  "www",
  "http",
  "https",
  "pute",
  "putes",
];
const BANNED_STEMS = ["officiel", "connard", "encul", "salop", "merde", "niqu", "batard"];
const LINK = /[a-z0-9-]+\.(com|fr|net|org|io|be|ch|info|bet)\b/;

/** True when a name contains a banned word, whatever its case, accents or spacing. */
export function isBannedName(input: string): boolean {
  // Words glued in camel case ("SuperConnard") are read apart.
  const plain = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  if (LINK.test(plain)) return true;
  // Letters typed apart ("F F A") are read as one word.
  const words = plain
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .reduce<string[]>((acc, token, i, all) => {
      const glued = token.length === 1 && i > 0 && all[i - 1]!.length === 1;
      if (glued) acc[acc.length - 1] += token;
      else acc.push(token);
      return acc;
    }, []);
  return words.some(
    (w) => BANNED_WORDS.includes(w) || BANNED_STEMS.some((stem) => w.startsWith(stem)),
  );
}
