import { UseCaseError } from "@/application/errors";
import type { WikidataSource } from "@/application/wikidata-link";
import { LABEL_LANGUAGES, type WikidataEntity } from "@/domain/wikidata-match";

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
/** Wikidata's rules: name the project and give a contact, here the repository. */
export const WIKIDATA_USER_AGENT =
  "french-track-prono/1.0 (https://github.com/pwilfried/french-track-prono)";
/** wbgetentities reads at most 50 ids a request. */
export const WIKIDATA_BATCH = 50;
/** One request a second at most. */
export const WIKIDATA_INTERVAL_MS = 1000;
/** Wikidata answers "maxlag" when its servers lag more than this many seconds. */
export const WIKIDATA_MAXLAG = 5;
/** Tries of a request turned down for lag (or 429, 503) before giving up. */
export const WIKIDATA_TRIES = 6;

export type WikidataHttp = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

type Answer = {
  error?: { code?: string; info?: string; id?: string };
  search?: { id: string }[];
  entities?: Record<string, WikidataEntity & { missing?: string }>;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Adapter of the WikidataSource port on the Wikidata API (wbsearchentities, wbgetentities).
 * Requests go one after the other, at least a second apart, with maxlag=5: a lagged answer is
 * retried after the wait Wikidata asks for. A failure throws WIKIDATA_UNAVAILABLE.
 */
export function createWikidataSource(http: WikidataHttp = {}): WikidataSource {
  const send = http.fetch ?? fetch;
  const sleep = http.sleep ?? wait;
  const now = http.now ?? Date.now;
  let queue: Promise<unknown> = Promise.resolve();
  let lastSent = -Infinity;

  async function once(params: Record<string, string>): Promise<Answer> {
    const url = new URL(WIKIDATA_API);
    const query = {
      ...params,
      format: "json",
      formatversion: "1",
      maxlag: String(WIKIDATA_MAXLAG),
    };
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    for (let attempt = 1; ; attempt++) {
      const pause = lastSent + WIKIDATA_INTERVAL_MS - now();
      if (pause > 0) await sleep(pause);
      lastSent = now();
      let response: Response;
      try {
        response = await send(url, {
          headers: { "User-Agent": WIKIDATA_USER_AGENT, "Api-User-Agent": WIKIDATA_USER_AGENT },
        });
      } catch {
        throw new UseCaseError("WIKIDATA_UNAVAILABLE");
      }
      const answer = response.ok ? ((await response.json()) as Answer) : null;
      const busy =
        answer?.error?.code === "maxlag" || response.status === 429 || response.status === 503;
      if (busy && attempt < WIKIDATA_TRIES) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await sleep(
          (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : WIKIDATA_MAXLAG) * 1000,
        );
        continue;
      }
      const unknownId = answer?.error?.code === "no-such-entity";
      if (!answer || (answer.error && !unknownId)) throw new UseCaseError("WIKIDATA_UNAVAILABLE");
      return answer;
    }
  }

  /** Serial: a request starts once the one before is over. */
  function request(params: Record<string, string>): Promise<Answer> {
    const next = queue.then(() => once(params));
    queue = next.catch(() => undefined);
    return next;
  }

  return {
    async search(name, language, limit) {
      const answer = await request({
        action: "wbsearchentities",
        search: name,
        language,
        uselang: language,
        type: "item",
        limit: String(limit),
      });
      return (answer.search ?? []).map((hit) => hit.id);
    },
    async getEntities(ids) {
      const entities: WikidataEntity[] = [];
      for (let start = 0; start < ids.length; start += WIKIDATA_BATCH) {
        let batch = ids.slice(start, start + WIKIDATA_BATCH);
        while (batch.length > 0) {
          const answer = await request({
            action: "wbgetentities",
            ids: batch.join("|"),
            props: "labels|descriptions|aliases|claims|sitelinks",
            languages: LABEL_LANGUAGES.join("|"),
            sitefilter: "frwiki|enwiki",
          });
          // An unknown id fails the whole batch: read the batch again without it.
          const unknown = answer.error?.id;
          if (unknown !== undefined) {
            if (!batch.includes(unknown)) throw new UseCaseError("WIKIDATA_UNAVAILABLE");
            batch = batch.filter((id) => id !== unknown);
            continue;
          }
          // A merged item comes back under the id it was merged into.
          for (const entity of Object.values(answer.entities ?? {})) {
            if (entity.missing === undefined) entities.push(entity);
          }
          break;
        }
      }
      return entities;
    },
  };
}
