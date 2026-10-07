import { readFileSync } from "node:fs";

import { transform } from "@solidjs/compiler";
import type { TransformOptions } from "@solidjs/compiler";

/**
 * The options this package adds on top of `@solidjs/compiler`'s own.
 *
 * Everything else is forwarded verbatim, so anything the native compiler can
 * do is reachable from here.
 */
export interface SolidJsxOptions {
  /**
   * Which runtime to emit calls against. `"auto"` reads the installed
   * `solid-js` and picks the matching module and built-ins.
   */
  target?: "auto" | "solid1" | "solid2";
  /** Client or server output. */
  generate?: "dom" | "ssr" | "universal";
  /** Emit hydration markers. Only meaningful with `generate: "ssr"`. */
  hydratable?: boolean;
  /** Dev-only names and validation. Defaults to `NODE_ENV !== "production"`. */
  dev?: boolean;
  /** Inline a source map in the output. */
  sourceMap?: boolean;
  /** Directory that stack traces and source names resolve against. */
  cwd?: string;
}

export interface TransformInput {
  /** Module source. */
  code: string;
  /** Absolute path, used for source names and error positions. */
  filename: string;
}

export interface TransformOutput {
  code: string;
  map?: string;
}

/** Control-flow tags Solid 1's runtime actually exports. */
export const SOLID1_BUILTINS = ["For", "Show", "Switch", "Match", "Portal", "Dynamic"] as const;

/** Solid 2 adds `Loading`, `Reveal`, `Repeat` and `Errored`; `Index` is gone. */
export const SOLID2_BUILTINS = [
  "For",
  "Show",
  "Switch",
  "Match",
  "Loading",
  "Reveal",
  "Portal",
  "Repeat",
  "Dynamic",
  "Errored",
] as const;

export interface Preset {
  moduleName: string;
  builtIns: readonly string[];
  generate: NonNullable<TransformOptions["generate"]>;
}

/**
 * The module and built-ins for a Solid major version.
 *
 * This is the whole reason one package can serve both: the native compiler
 * takes the runtime's module name as a string and substitutes it everywhere,
 * auto-imported built-ins included. The *emitted* code still differs between
 * the majors — 2.0 emits two-argument effects and treats `class:` and
 * `classList` as literal attributes — so the preset picks the runtime, not a
 * compatibility shim.
 */
export function presetFor(target: Exclude<SolidJsxOptions["target"], undefined | "auto">): Preset {
  return target === "solid1"
    ? { moduleName: "solid-js/web", builtIns: SOLID1_BUILTINS, generate: "dom" }
    : { moduleName: "@solidjs/web", builtIns: SOLID2_BUILTINS, generate: "dom" };
}

let cachedMajor: 1 | 2 | undefined;

/**
 * Which Solid major is installed, read from `solid-js`'s own manifest.
 *
 * Detected once per process. A missing `solid-js` resolves to 2 — the newer
 * default — rather than throwing: the compiler emits correct code either way,
 * and a wrong guess would fail loudly at the import instead.
 */
export function detectSolidMajor(cwd: string = process.cwd()): 1 | 2 {
  if (cachedMajor !== undefined) return cachedMajor;

  try {
    const entry = Bun.resolveSync("solid-js/package.json", cwd);
    const manifest = JSON.parse(readFileSync(entry, "utf8")) as { version?: string };
    cachedMajor = manifest.version?.startsWith("1.") ? 1 : 2;
  } catch {
    cachedMajor = 2;
  }

  return cachedMajor;
}

/**
 * Compile one module's JSX.
 *
 * TypeScript is **not** handled here: `@solidjs/compiler` is a JSX-only
 * transform and leaves `interface`, annotations and `as` in place, exactly
 * as Babel's JSX plugin does. Stripping is the host's job — `Bun.Transpiler`
 * for Bun, the bundler for Vite.
 */
export function transformSync(input: TransformInput, options: SolidJsxOptions = {}): TransformOutput {
  const target = options.target ?? "auto";
  const major = target === "auto" ? detectSolidMajor(options.cwd) : target === "solid1" ? 1 : 2;
  const preset = presetFor(major === 1 ? "solid1" : "solid2");

  const result = transform(input.code, {
    filename: input.filename,
    moduleName: preset.moduleName,
    builtIns: [...preset.builtIns],
    generate: options.generate ?? preset.generate,
    hydratable: options.hydratable ?? false,
    dev: options.dev ?? process.env.NODE_ENV !== "production",
    sourceMap: options.sourceMap ?? false,
  });

  const output: TransformOutput = { code: result.code };
  if (options.sourceMap && result.map) output.map = result.map;
  return output;
}

/** The async form, for callers that already await their pipeline. */
export async function transformAsync(
  input: TransformInput,
  options: SolidJsxOptions = {},
): Promise<TransformOutput> {
  return transformSync(input, options);
}

/** Reset the cached detection. Test-only. */
export function resetDetection(): void {
  cachedMajor = undefined;
}