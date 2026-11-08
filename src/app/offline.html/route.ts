import { messages } from "../messages.fr";

// The page the service worker shows offline. Plain HTML without scripts or fonts, so it works
// from the cache alone; generated at build time from the messages file.
export const dynamic = "force-static";

const t = messages.offline;

const HTML = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${t.title} · ${messages.app.name}</title>
    <style>
      :root { --bg: #fdfbf5; --fg: #052b5c; --muted: #4a5a78; }
      @media (prefers-color-scheme: dark) { :root { --bg: #052b5c; --fg: #fdfbf5; --muted: #b8c6de; } }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg);
        color: var(--fg); font-family: system-ui, sans-serif; text-align: center; padding: 16px; }
      main { max-width: 22rem; }
      h1 { font-size: 1.6rem; margin: 1rem 0 0.5rem; }
      p { color: var(--muted); line-height: 1.5; }
      a { display: inline-flex; min-height: 44px; align-items: center; padding: 0 1.5rem;
        border-radius: 999px; background: #c42818; color: #fff; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <picture>
        <source srcset="/brand/frenchtrack-dark.png" media="(prefers-color-scheme: dark)" />
        <img src="/brand/frenchtrack-light.png" alt="FrenchTrack" width="96" height="111" />
      </picture>
      <h1>${t.title}</h1>
      <p>${t.body}</p>
      <a href="/">${t.retry}</a>
    </main>
  </body>
</html>
`;

export function GET() {
  return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
