import type { BunPlugin } from "bun";

import { transformSync, type SolidJsxOptions } from "./transform";

/**
 * A Bun plugin that compiles Solid JSX.
 *
 * Why it has to exist at all: `@solidjs/web` exports `template`, `insert`
 * and `spread`, but **no `jsx`, `jsxs` or `jsxDEV`**. Bun's automatic JSX
 * runtime looks for exactly those names and resolves
 * `@solidjs/web/jsx-runtime`, which exists as an export entry and a set of
 * types but contains none of them. Solid's JSX therefore has to be compiled
 * before Bun ever sees it — and the native Oxc compiler does that in
 * microseconds, with no Babel in the process.
 *
 * Two stages, in this order:
 *
 *   1. `@solidjs/compiler` rewrites JSX into `template` / `insert` /
 *      `createComponent` calls. It is a **JSX-only** transform: `interface`,
 *      annotations and `as` all survive it, exactly as they survive Babel's
 *      JSX plugin.
 *   2. `Bun.Transpiler` removes what stage 1 left behind.
 *
 * ```ts
 * // bunfig.toml
 * preload = ["./solid-preload.ts"]
 *
 * // solid-preload.ts
 * import { solidBunPlugin } from "@prestgg/solid-jsx/bun";
 * Bun.plugin(solidBunPlugin());
 * ```
 *
 * The same object also goes into `Bun.build({ plugins: [...] })`, so a build
 * and the dev/test runtime compile identically.
 */
export function solidBunPlugin(options: SolidJsxOptions = {}): BunPlugin {
  return {
    name: "@prestgg/solid-jsx",
    setup(build) {
      build.onLoad({ filter: /\.[jt]sx$/ }, async ({ path }) => {
        const result = transformSync(
          { code: await Bun.file(path).text(), filename: path },
          options,
        );

        // Stage 2. `Bun.Transpiler` is Bun's own, so the package needs no
        // TypeScript dependency of its own.
        const cleaned = new Bun.Transpiler({ loader: "ts" }).transformSync(result.code);

        return { contents: cleaned, loader: "js" };
      });
    },
  };
}

export default solidBunPlugin;