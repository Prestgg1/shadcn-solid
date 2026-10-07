import type { BunPlugin } from "bun";

import { transformAsync } from "@babel/core";
import ts from "@babel/preset-typescript";
import solid from "babel-preset-solid";

/**
 * Bun plugin that compiles `.ts` / `.tsx` with Solid's JSX transform.
 *
 * Why this exists: `solid-js/web` exports `template`, `insert` and `spread`,
 * but **no** `jsx` / `jsxs` / `jsxDEV`. Bun's automatic JSX runtime needs
 * exactly those names and would otherwise resolve `solid-js/jsx-runtime`,
 * which re-exports the core build and has none of them. Solid's compiler has
 * to run, and it emits the low-level calls directly.
 *
 * `generate: "dom"` selects the client runtime — the counterpart of
 * `--conditions=browser`, without which `createEffect` would be a no-op.
 */
const SOLID_BABEL = {
  filename: "component.tsx",
  presets: [
    [solid, { generate: "dom", hydratable: false }],
    [ts, {}],
  ],
  sourceMaps: "inline",
} as const;

export const solidJsxPlugin: BunPlugin = {
  name: "solid-jsx",
  setup(build) {
    build.onLoad({ filter: /\.[jt]sx$/ }, async ({ path }) => {
      const { readFile } = await import("node:fs/promises");
      const source = await readFile(path, "utf8");
      const result = await transformAsync(source, { ...SOLID_BABEL, filename: path });

      if (!result?.code) throw new Error(`solid-jsx: could not transform ${path}`);

      return { contents: result.code, loader: "js" };
    });
  },
};
