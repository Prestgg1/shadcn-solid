import { describe, expect, test } from "bun:test";

import {
  detectSolidMajor,
  presetFor,
  resetDetection,
  SOLID1_BUILTINS,
  SOLID2_BUILTINS,
  transformSync,
} from "./transform";

/**
 * The questions that decided whether this package could exist at all.
 *
 * `solid-js/web` and `@solidjs/web` export `template`, `insert` and
 * `spread` but no `jsx`/`jsxs`/`jsxDEV`, which is why Bun cannot compile
 * Solid on its own. Every test here checks a promise the compiler has to
 * keep: that what it emits exists at runtime, and that what it leaves behind
 * is the host's problem.
 */
const component = `
interface Props { title: string }
const open = true;
export function Panel(props: Props) {
  return (
    <div class="panel" data-open={open} title={props.title}>
      <Show when={open}><span>{props.title}</span></Show>
      <For each={[1, 2]}>{n => <b>{n}</b>}</For>
      <button onClick={() => console.log(props.title)}>go</button>
    </div>
  );
}
`;

/**
 * Solid 1.9's `solid-js/web` exports, limited to what the compiler emits.
 * Asserted as a literal because this workspace runs Solid 2, so the 1.x
 * module cannot be imported to check against.
 */
const SOLID1_WEB_EXPORTS = new Set([
  "template", "insert", "spread", "effect", "memo", "createComponent",
  "delegateEvents", "addEventListener", "removeEventListener",
  "setAttribute", "setProperty", "setStyleProperty", "className", "style",
  "use", "Dynamic", "Show", "For", "Switch", "Match", "Portal", "render",
  "hydrate", "ssr", "escape", "ssrHydrationKey", "ssrAttribute", "getNextElement",
]);

const importsOf = (code: string): string[] =>
  [...code.matchAll(/import \{([^}]+)\} from "([^"]+)"/g)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((name) => name.trim().split(" as ")[0]!.trim())
      .filter(Boolean),
  );

describe("transformSync", () => {
  test("emits calls the runtime actually exports", async () => {
    const { code } = transformSync(
      { code: component, filename: "Panel.tsx" },
      { target: "solid2" },
    );

    const web = await import("@solidjs/web");
    const core = await import("solid-js");
    const missing = importsOf(code).filter((name) => !(name in web) && !(name in core));

    expect(missing).toEqual([]);
    expect(code).toContain("from \"@solidjs/web\"");
  });

  test("reads the filename extension to decide whether TS is allowed", () => {
    // `@solidjs/compiler` parses `.tsx` as TypeScript and `.jsx` as plain
    // JavaScript, so a plugin has to pass the real path through rather than
    // inventing one — the difference is a syntax error, not a warning.
    expect(() =>
      transformSync({ code: component, filename: "Panel.jsx" }, { target: "solid2" }),
    ).toThrow();
  });

  test("leaves TypeScript for the host, as documented", () => {
    const { code } = transformSync({ code: component, filename: "Panel.tsx" }, { target: "solid2" });

    // JSX-only transform: annotations survive, which is exactly why the Bun
    // plugin runs Bun.Transpiler afterwards.
    expect(code).toContain("interface Props");
    expect(code).toContain(": Props");
  });

  test("targets Solid 1's module name when asked", () => {
    const { code } = transformSync(
      { code: component, filename: "Panel.tsx" },
      { target: "solid1" },
    );

    expect(code).toContain("from \"solid-js/web\"");
    // Checked against Solid 1's documented `solid-js/web` exports rather than
    // by importing it: this workspace installs Solid 2, and the point of the
    // test is that the *names* are ones 1.9 has.
    const unknown = importsOf(code).filter((name) => !SOLID1_WEB_EXPORTS.has(name));
    expect(unknown).toEqual([]);
  });

  test("only auto-imports built-ins the target runtime exports", async () => {
    const withBlocks = `export const A = () => <Loading><Errored fallback={f}><p/></Errored></Loading>;`;

    const solid1 = transformSync({ code: withBlocks, filename: "a.tsx" }, { target: "solid1" });
    // `Loading` and `Errored` are 2.0 additions. Leaving them out of the
    // Solid 1 built-ins means the compiler does not auto-import them — it
    // treats them as the user's own identifiers, so a 1.9 project gets no
    // unresolvable import. Under Solid 2 they are imported from the runtime.
    expect(importsOf(solid1.code).filter((n) => !SOLID1_WEB_EXPORTS.has(n))).toEqual([]);
    expect(importsOf(solid1.code)).not.toContain("Loading");
    expect(importsOf(solid1.code)).not.toContain("Errored");

    const solid2 = transformSync({ code: withBlocks, filename: "a.tsx" }, { target: "solid2" });
    const solid2Web = new Set(Object.keys(await import("@solidjs/web")));
    expect(importsOf(solid2.code).filter((n) => !solid2Web.has(n))).toEqual([]);
    expect(importsOf(solid2.code)).toContain("Loading");
  });

  test("ssr output imports only real symbols and emits hydration markers", async () => {
    const { code } = transformSync(
      { code: component, filename: "Panel.tsx" },
      { target: "solid2", generate: "ssr", hydratable: true },
    );

    const web = await import("@solidjs/web");
    expect(importsOf(code).filter((name) => !(name in web))).toEqual([]);
    expect(code).toContain("ssrHydrationKey");
  });

  test("defaults to DOM output", () => {
    const { code } = transformSync({ code: component, filename: "Panel.tsx" }, { target: "solid2" });
    expect(code).toContain("_$template");
  });
});

describe("presetFor", () => {
  test("maps each Solid major to its module and built-ins", () => {
    expect(presetFor("solid1")).toMatchObject({ moduleName: "solid-js/web" });
    expect(presetFor("solid2")).toMatchObject({ moduleName: "@solidjs/web" });
    expect(SOLID1_BUILTINS).not.toContain("Loading");
    expect(SOLID2_BUILTINS).toContain("Loading");
    expect(SOLID2_BUILTINS).toContain("Errored");
  });
});

describe("detectSolidMajor", () => {
  test("reads the installed solid-js", () => {
    resetDetection();
    // This workspace installs Solid 2, so auto-detection must say so.
    expect(detectSolidMajor()).toBe(2);
  });

  test("falls back to 2 rather than throwing", () => {
    resetDetection();
    expect(detectSolidMajor("/nonexistent-directory")).toBe(2);
    resetDetection();
  });
});
