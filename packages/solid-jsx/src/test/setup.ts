/**
 * Test bootstrap.
 *
 * `--conditions=browser` (package script) picks `@solidjs/web`'s client
 * build; without it the runtime resolves the server build and every render
 * throws "client-only API called on the server side".
 *
 * happy-dom supplies the DOM. Bun ships none, and these tests render.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (typeof document === "undefined") {
  GlobalRegistrator.register({ url: "https://example.test" });
}
