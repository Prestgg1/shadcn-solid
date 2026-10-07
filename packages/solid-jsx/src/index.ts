/**
 * `@prestgg/solid-jsx` — Solid JSX for Bun, on the native Oxc compiler.
 *
 * The problem: `solid-js/web` and `@solidjs/web` export `template`,
 * `insert` and `spread`, but no `jsx`/`jsxs`/`jsxDEV`. Bun's automatic JSX
 * runtime looks for those names, so Solid's JSX has to be compiled before
 * Bun reads it. Until Solid 2's native compiler arrived, every Bun user had
 * to pull in Babel.
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
 * Then set `"jsxImportSource": "@solidjs/web"` in `tsconfig.json`, or run
 * `solid-jsx init`.
 */
export {
  transformSync,
  transformAsync,
  detectSolidMajor,
  presetFor,
  resetDetection,
  SOLID1_BUILTINS,
  SOLID2_BUILTINS,
  type Preset,
  type SolidJsxOptions,
  type TransformInput,
  type TransformOutput,
} from "./transform";

export { solidBunPlugin } from "./bun";
export { applyConfig, solidPreloadSource, withJsxImportSource, type ConfigOptions } from "./config";
export type * from "./config";