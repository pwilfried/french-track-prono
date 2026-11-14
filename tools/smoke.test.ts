import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const script = resolve("scripts/smoke.sh");

// Every page the smoke test checks, in one body: each check finds its text, and the list of events
// links one event.
const body = `French Track Prono Comment jouer Connexion Mentions légales href="/epreuves/demo-100m"`;

// Runs the smoke test with a fake curl that records the -H headers of each call (one line per
// call), writes the body to -o (or stdout) and prints 200 for -w.
function smoke(env: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "smoke-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const calls = join(root, "calls");
  writeFileSync(calls, "");
  const curl = join(bin, "curl");
  writeFileSync(
    curl,
    `#!/usr/bin/env bash
out=""; status=""; headers=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out=$2; shift ;;
    -w) status=200; shift ;;
    -H) headers="$headers[$2]"; shift ;;
    --max-time) shift ;;
  esac
  shift
done
echo "curl\${headers:+ $headers}" >> "${calls}"
if [ -n "$out" ]; then printf '%s' '${body}' > "$out"; else printf '%s' '${body}'; fi
printf '%s' "$status"
`,
  );
  chmodSync(curl, 0o755);
  const inherited = { ...process.env };
  delete inherited.VERCEL_AUTOMATION_BYPASS_SECRET;
  const run = spawnSync("bash", [script, "https://preprod.example.test"], {
    encoding: "utf8",
    env: { ...inherited, PATH: `${bin}:${process.env.PATH}`, ...env },
  });
  return {
    status: run.status,
    output: run.stdout + run.stderr,
    calls: readFileSync(calls, "utf8").trim().split("\n"),
  };
}

describe("scripts/smoke.sh", () => {
  it("sends no extra header when no protection bypass secret is set", () => {
    const run = smoke();

    expect(run.status).toBe(0);
    expect(run.calls.length).toBeGreaterThan(5);
    for (const call of run.calls) expect(call).toBe("curl");
  });

  it("sends the Vercel protection bypass header on every request when the secret is set", () => {
    const run = smoke({ VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret-value" });

    expect(run.status).toBe(0);
    expect(run.calls.length).toBeGreaterThan(5);
    for (const call of run.calls) {
      expect(call).toBe("curl [x-vercel-protection-bypass: bypass-secret-value]");
    }
    expect(run.output).not.toContain("bypass-secret-value");
  });
});
