import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { detectSolidMajor } from "./transform";

export interface ConfigOptions {
  /** Project root. */
  cwd: string;
  /** Where the preload file goes. Default `solid-preload.ts` in the root. */
  preload?: string;
  /** Overwrite existing files. Off by default — this edits real config. */
  force?: boolean;
}

/** The contents of the preload file. Kept here so `init` and the docs agree. */
export function solidPreloadSource(): string {
  return [
    "/**",
    " * Compiles Solid JSX for Bun, using Solid's native Oxc compiler.",
    " *",
    " * Preloaded from bunfig.toml, so it applies to `bun run`, `bun test`",
    " * and anything Bun loads afterwards. Load order in `preload` matters:",
    " * this must come before any file that renders JSX.",
    " */",
    'import { solidBunPlugin } from "@prestgg/solid-jsx/bun";',
    "",
    "Bun.plugin(solidBunPlugin());",
    "",
  ].join("\n");
}

/** Where the runtime's JSX import source belongs, per Solid major. */
function jsxImportSource(major: 1 | 2): string {
  return major === 1 ? "solid-js/web" : "@solidjs/web";
}

/**
 * Point `tsconfig.json` at the runtime's JSX entry and preload the plugin.
 *
 * Written to merge rather than replace: a `tsconfig.json` with paths, include
 * and a dozen other settings is not something a setup command gets to
 * overwrite, so the existing keys are parsed and only the two that matter are
 * set.
 */
export async function applyConfig(options: ConfigOptions): Promise<string[]> {
  const cwd = resolve(options.cwd);
  const changed: string[] = [];

  // --- preload ----------------------------------------------------------
  const preloadPath = join(cwd, options.preload ?? "solid-preload.ts");
  if (existsSync(preloadPath) && !options.force) {
    // Left alone: it may hold other preload logic.
  } else {
    await mkdir(dirname(preloadPath), { recursive: true });
    await writeFile(preloadPath, solidPreloadSource(), "utf8");
    changed.push(preloadPath);
  }

  const bunfigPath = join(cwd, "bunfig.toml");
  const existing = existsSync(bunfigPath) ? await readFile(bunfigPath, "utf8") : "";
  const preloadEntry = `"./${options.preload ?? "solid-preload.ts"}"`;

  if (!existing.includes(preloadEntry)) {
    const next = existing.includes("preload")
      ? existing.replace(/preload\s*=\s*\[([^\]]*)\]/, (_match, list: string) =>
          `preload = [${list.trim().replace(/,\s*$/, "")}, ${preloadEntry}]`,
        )
      : `preload = [${preloadEntry}]\n${existing ? `\n${existing.trim()}\n` : ""}`;
    await writeFile(bunfigPath, next.trimStart(), "utf8");
    changed.push(bunfigPath);
  }

  // --- tsconfig ---------------------------------------------------------
  const tsconfigPath = join(cwd, "tsconfig.json");
  const source = existsSync(tsconfigPath) ? await readFile(tsconfigPath, "utf8") : "";
  const want = jsxImportSource(detectSolidMajor(cwd));

  if (!source.includes('"jsxImportSource"')) {
    await writeFile(tsconfigPath, withJsxImportSource(source, want), "utf8");
    changed.push(tsconfigPath);
  }

  return changed;
}

/**
 * Add `jsx` and `jsxImportSource` to a tsconfig without disturbing the rest.
 *
 * A tsconfig is not necessarily valid JSON — `extends` targets, trailing
 * commas and comments are all legal — so the file is edited textually
 * rather than parsed and rewritten.
 */
export function withJsxImportSource(source: string, runtime: string): string {
  const entry = `"jsx": "preserve",\n    "jsxImportSource": "${runtime}"`;

  if (source.includes('"compilerOptions"')) {
    // Insert as the first keys of the existing object.
    return source.replace(/"compilerOptions"\s*:\s*\{/, `"compilerOptions": {\n    ${entry},`);
  }

  if (/^\s*\{\s*\}\s*$/.test(source)) return `{\n  "compilerOptions": {\n    ${entry}\n  }\n}\n`;

  if (source.trim() === "") return `{\n  "compilerOptions": {\n    ${entry}\n  }\n}\n`;

  // No compilerOptions block: add one before the closing brace.
  const closing = source.lastIndexOf("}");
  if (closing === -1) return source;

  const head = source.slice(0, closing).replace(/,\s*$/, "");
  return `${head},\n  "compilerOptions": {\n    ${entry}\n  }\n}\n`;
}