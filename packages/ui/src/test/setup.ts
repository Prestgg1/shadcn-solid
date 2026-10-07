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
