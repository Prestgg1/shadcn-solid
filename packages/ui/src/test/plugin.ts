/**
 * Installs the Solid JSX compiler for the test run.
 *
 * Bun's automatic JSX runtime resolves `@solidjs/web/jsx-runtime`, which
 * exports no `jsx`/`jsxs`/`jsxDEV` — Solid's compiler has to run first.
 * `bunfig.toml`'s `[test] preload` is what makes this apply to test files.
 */
import { solidBunPlugin } from "@prestgg/solid-jsx/bun";

Bun.plugin(solidBunPlugin());
