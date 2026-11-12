import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, it } from "vitest";

// #580: the local Supabase ports are in Linux's ephemeral range (32768-60999). An outgoing
// connection (the image pulls of `supabase start`) can hold one when the database binds it, so the
// CI reserves them before starting Supabase.
const RESERVE = "sudo sysctl -w net.ipv4.ip_local_reserved_ports=54320-54329";

it("reserves the local Supabase ports before every supabase start in CI", () => {
  const dir = ".github/workflows";
  const starts = readdirSync(dir)
    .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }))
    .filter(({ text }) => text.includes("run: supabase start"));
  expect(starts.length).toBeGreaterThan(0);
  for (const { file, text } of starts) {
    const reserved = text.indexOf(RESERVE);
    expect(reserved, `${file} reserves the ports`).toBeGreaterThanOrEqual(0);
    expect(reserved, `${file} reserves them before starting`).toBeLessThan(
      text.indexOf("run: supabase start"),
    );
  }
});

it("keeps every local Supabase port inside the reserved range", () => {
  const ports = [
    ...readFileSync("supabase/config.toml", "utf8").matchAll(/^\s*\w*port\s*=\s*(\d+)/gm),
  ]
    .map((m) => Number(m[1]))
    .filter((port) => port >= 32768);
  expect(ports.length).toBeGreaterThan(0);
  for (const port of ports) expect(port).toSatisfy((p: number) => p >= 54320 && p <= 54329);
});
