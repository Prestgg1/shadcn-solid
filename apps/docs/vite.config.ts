import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import solid from "@solidjs/vite-plugin";
import { fileURLToPath } from "node:url";

/**
 * The docs site.
 *
 * SolidStart does not support Solid 2 — `@solidjs/start` depends on
 * `solid-js ^1.9`. So this is plain Vite with client-side rendering, which
 * is all a component reference needs.
 *
 * It also *installs* the library and adds components through the CLI into
 * `src/`, then imports those copies. That is deliberate: the docs then
 * exercise the same artifact a user gets, rather than the package internals
 * whose aliases would not resolve here.
 */
export default defineConfig({
  plugins: [solid({ ssr: false }), tailwindcss()],
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
});
