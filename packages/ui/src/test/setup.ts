/**
 * Registers a DOM in Bun's test runner.
 *
 * Bun ships no DOM, and the primitives here are DOM primitives: focus
 * management, positioning, scroll locking. Without this, `document` is
 * simply undefined and the tests would pass vacuously.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (typeof document === "undefined") {
  GlobalRegistrator.register({ url: "https://example.test" });
}