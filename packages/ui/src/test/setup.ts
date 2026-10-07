/**
 * Test bootstrap.
 *
 * `--conditions=browser` (package script) resolves `@solidjs/web`'s client
 * build. Without it the server build loads and every render throws
 * "client-only API called on the server side".
 *
 * happy-dom supplies the DOM; Bun ships none.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (typeof document === "undefined") {
  GlobalRegistrator.register({ url: "https://example.test" });
}

/**
 * Unmount everything a test rendered, whatever else is loaded.
 *
 * `@solidjs/testing-library` registers its own `afterEach(cleanup)`, but only
 * when its module is first evaluated — and the `typeof afterEach` guard it
 * uses means that registration depends on which test files Bun happens to
 * load first. That is not something a test should be able to fail on, and a
 * leaked root is nasty to diagnose: a leftover `dialog-content` in
 * `document.body` makes the *next* test's `querySelector` find the previous
 * one's element.
 *
 * Registered here so every file gets it, not just the first one loaded.
 */
import { afterEach } from "bun:test";
import { cleanup } from "@solidjs/testing-library";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});
