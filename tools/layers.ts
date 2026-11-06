// Layer import rule (docs/architecture.md, "Couches"):
//   domain      imports only domain
//   application imports only domain and application
//   infra       imports domain, application, infra and npm packages (never app)
//   app         imports anything, but reaches infra only through its public entry point ("@/infra")
// Files outside the four layers (src/lib, src/components, ...) are not checked.
import path from "node:path";

export type SourceFile = { path: string; content: string };
export type Violation = { file: string; layer: string; specifier: string; message: string };

const LAYERS = ["domain", "application", "infra", "app"] as const;
type Layer = (typeof LAYERS)[number];

const ALLOWED: Record<Layer, readonly string[]> = {
  domain: ["domain"],
  application: ["domain", "application"],
  infra: ["domain", "application", "infra", "other"],
  app: ["domain", "application", "infra", "app", "other"],
};

const EXTERNAL_ALLOWED: Record<Layer, boolean> = {
  domain: false,
  application: false,
  infra: true,
  app: true,
};

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'"`;]*?\sfrom\s*["']([^"']+)["']/g, // import x from "y" / export * from "y"
  /\bimport\s*["']([^"']+)["']/g, // import "y"
  /\bimport\(\s*["']([^"']+)["']\s*\)/g, // import("y")
];

export function importsOf(content: string): string[] {
  const found: string[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of content.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

function layerOfFile(file: string): Layer | null {
  const match = /^src\/([^/]+)\//.exec(file);
  return match && (LAYERS as readonly string[]).includes(match[1]) ? (match[1] as Layer) : null;
}

type Target = { kind: "external" } | { kind: "internal"; segments: string[] };

function resolve(file: string, specifier: string): Target {
  let internal: string | null = null;
  if (specifier.startsWith("@/")) internal = specifier.slice(2);
  else if (specifier.startsWith(".")) {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    internal = resolved.replace(/^src\//, "");
  }
  if (internal === null) return { kind: "external" };
  return { kind: "internal", segments: internal.split("/").filter(Boolean) };
}

export function checkLayers(files: SourceFile[]): Violation[] {
  const violations: Violation[] = [];
  for (const { path: file, content } of files) {
    const layer = layerOfFile(file);
    if (!layer) continue;

    for (const specifier of importsOf(content)) {
      const fail = (message: string) => violations.push({ file, layer, specifier, message });
      const target = resolve(file, specifier);

      if (target.kind === "external") {
        if (!EXTERNAL_ALLOWED[layer])
          fail(`${layer} must not import "${specifier}" (npm package or builtin)`);
        continue;
      }

      const [first, ...rest] = target.segments;
      const targetLayer = (LAYERS as readonly string[]).includes(first) ? first : "other";
      if (!ALLOWED[layer].includes(targetLayer)) {
        fail(`${layer} must not import the ${targetLayer} layer ("${specifier}")`);
        continue;
      }
      const isInfraInternal =
        targetLayer === "infra" &&
        layer === "app" &&
        rest.length > 0 &&
        !(rest.length === 1 && rest[0] === "index");
      if (isInfraInternal) fail(`app must import infra only through "@/infra", not "${specifier}"`);
    }
  }
  return violations;
}
