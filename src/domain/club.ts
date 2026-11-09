// Athletics clubs (#339): the names come from the State's company register, in capitals
// ("ATHLETIC CLUB DE BOULOGNE BILLANCOURT (ACBB)"). Pure rules to clean them and search them.

/** Lower case, no accents, words separated by one space. Same key as the database. */
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Other sports found by the register queries ("athlétique", "athletic"...).
const OTHER_SPORTS = [
  "handball",
  "hand ball",
  "petanque",
  "cyclo",
  "velo",
  "vtt",
  "halterophil",
  "haltero",
  "football",
  "foot ball",
  "basket",
  "tennis",
  "rugby",
  "natation",
  "judo",
  "boxe",
  "volley",
  "badminton",
  "golf",
  "equitation",
  "escrime",
  "karate",
  "danse",
  "musculation",
  "hockey",
  "billard",
  "bowling",
  "ski ",
  "voile",
  "aviron",
  "canoe",
  "kayak",
  "plongee",
  "roller",
  "patinage",
  "lutte",
  "triathlon",
  "tir a l arc",
  "baseball",
  "cricket",
  "rink",
  "quilles",
];

/** True when the register name looks like an athletics club and not another sport. */
export function isAthleticsClubName(name: string): boolean {
  const key = ` ${searchKey(name)} `;
  return !OTHER_SPORTS.some((sport) => key.includes(sport));
}

const SMALL_WORDS = new Set([
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "et",
  "en",
  "sur",
  "sous",
  "a",
  "au",
  "aux",
  "d",
  "l",
]);
// Short words that are real words or towns, not initials.
const SHORT_WORDS = new Set([
  "val",
  "bas",
  "sud",
  "est",
  "bay",
  "roc",
  "pic",
  "lac",
  "bel",
  "bon",
  "mer",
  "pre",
  "ile",
  "art",
  "run",
  "vie",
  "ain",
  "lot",
  "var",
  "gex",
  "dax",
  "pau",
  "ham",
  "bec",
  "fos",
  "sel",
  "foy",
  "luc",
  "may",
  "eu",
  "oye",
  "ste",
  "st",
  "mont",
  "pont",
  "fort",
  "port",
  "bois",
  "club",
  "team",
  "nord",
  "ouest",
  "ville",
  "aix",
  "albi",
  "agde",
  "auch",
  "metz",
  "nice",
  "caen",
  "lens",
  "sens",
  "vic",
  "riom",
  "bort",
  "gien",
  "lure",
  "cluses",
]);

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const ACRONYMS = new Set(["asptt", "asul", "acbb", "ascap", "capsa", "efsra", "uamg", "esta"]);

function formatWord(word: string, first: boolean): string {
  const lower = word.toLowerCase();
  // "d'athlétisme", "l'étoile"
  const elided = /^([dl])['’](.+)$/.exec(lower);
  if (elided) {
    return `${first ? elided[1]!.toUpperCase() : elided[1]}'${formatWord(elided[2]!, true)}`;
  }
  if (lower.includes("-")) {
    return lower
      .split("-")
      .map((part, i) => formatWord(part, first || i > 0))
      .join("-");
  }
  if (lower.includes(".")) return word.toUpperCase(); // "C.A."
  const plain = searchKey(lower);
  if (!first && SMALL_WORDS.has(plain)) return lower;
  if (plain === "st") return "St";
  if (plain === "ste") return "Ste";
  const letters = /^[a-z]+$/.test(plain);
  const initials =
    letters &&
    !SHORT_WORDS.has(plain) &&
    !SMALL_WORDS.has(plain) &&
    (plain.length <= 3 || !/[aeiouy]/.test(plain) || ACRONYMS.has(plain));
  return initials ? word.toUpperCase() : capitalize(lower);
}

/** "ATHLETIC CLUB DE BOULOGNE (ACBB)" → "Athletic Club de Boulogne (ACBB)". */
export function formatClubName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  return name
    .split(" ")
    .map((token, i) => {
      const inParens = /^\((.+)\)$/.exec(token);
      if (inParens) return `(${inParens[1]!.toUpperCase()})`;
      const open = /^\((.+)$/.exec(token);
      if (open) return `(${formatWord(open[1]!, true)}`;
      const close = /^(.+)\)$/.exec(token);
      if (close) return `${formatWord(close[1]!, i === 0)})`;
      return formatWord(token, i === 0);
    })
    .join(" ");
}

/** True when every word of the query is found in the club's name or town. */
export function matchesClub(query: string, club: { name: string; city: string }): boolean {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const haystack = searchKey(`${club.name} ${club.city}`);
  return words.every((word) => haystack.includes(word));
}
