/**
 * Test bootstrap for Bun.
 *
 * Three things have to be in place before a test file loads:
 *
 * 1. A Solid JSX transform, installed by `plugins/solid-jsx`.
 * 2. A DOM. `happy-dom` provides one; Bun ships none, and the primitives
 *    here are DOM primitives.
 * 3. `--conditions=browser`, set in the package script. Without it
 *    `solid-js` resolves to its server build, where `createEffect` is a
 *    no-op and every reactive test would pass without asserting anything.
 *
 * Test files are written without JSX (`h()` in `./h.ts`): the transform runs
 * from a preload, which is after Bun has decided how to parse the entry.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { solidJsxPlugin } from "../../plugins/solid-jsx";

Bun.plugin(solidJsxPlugin);

if (typeof document === "undefined") {
  GlobalRegistrator.register({ url: "https://example.test" });
}
