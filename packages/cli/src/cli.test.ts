import { describe, expect, test } from "bun:test";

import { rewriteImports } from "./commands/add";
import { detectAliasPrefix } from "./utils/alias";
import { DEFAULT_CONFIG, normalizeConfig } from "./utils/config";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const config = normalizeConfig({
  ...DEFAULT_CONFIG,
  aliases: {
    components: "@/components",
    utils: "@/lib/utils",
    ui: "@/components/ui",
    lib: "@/lib",
    hooks: "@/hooks",
  },
});

describe("rewriteImports", () => {
  test("points a component's imports of its siblings at the project", () => {
    const source = [
      'import { cn } from "~/lib/cn";',
      'import { buttonVariants } from "~/ui/button";',
      "export const x = 1;",
    ].join("\n");

    // A registry file that still says `~/ui/button` resolves inside this
    // repository and nowhere else, so the copy in a user's project is broken
    // until the prefixes are rewritten.
    expect(rewriteImports(source, config)).toBe(
      ['import { cn } from "@/lib/cn";', 'import { buttonVariants } from "@/components/ui/button";', "export const x = 1;"].join(
        "\n",
      ),
    );
  });

  test("follows whatever the project's aliases are", () => {
    const tilde = normalizeConfig({
      ...DEFAULT_CONFIG,
      aliases: { components: "~/components", utils: "~/lib/utils", ui: "~/components/ui", lib: "~/lib", hooks: "~/hooks" },
    });

    expect(rewriteImports('import { Label } from "~/ui/label";', tilde)).toBe(
      'import { Label } from "~/components/ui/label";',
    );
  });

  test("leaves everything else alone", () => {
    const source = 'import { Show } from "solid-js";\nimport { Router } from "@solidjs/router";';
    expect(rewriteImports(source, config)).toBe(source);
  });

  test("does not double a trailing slash on the alias", () => {
    const trailing = normalizeConfig({
      ...DEFAULT_CONFIG,
      aliases: { components: "@/components/", utils: "@/lib/utils", ui: "@/components/ui/", lib: "@/lib/", hooks: "@/hooks" },
    });

    expect(rewriteImports('import { cn } from "~/lib/cn";', trailing)).toBe('import { cn } from "@/lib/cn";');
  });
});

/** A throwaway project root. */
async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "solid-ui-"));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, name), content, "utf8");
  }
  return root;
}

describe("detectAliasPrefix", () => {
  test("finds the wildcard alias a project already uses", async () => {
    const root = await project({
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "~/*": ["./src/*"] } } }),
    });

    // A SolidStart project gets `~/components/ui`, not an `@/` its own
    // tsconfig cannot resolve.
    expect(await detectAliasPrefix(root)).toBe("~");
    await rm(root, { recursive: true, force: true });
  });

  test("finds an @/ alias too", async () => {
    const root = await project({
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    });

    expect(await detectAliasPrefix(root)).toBe("@");
    await rm(root, { recursive: true, force: true });
  });

  test("returns nothing when the project has no alias", async () => {
    const root = await project({ "tsconfig.json": JSON.stringify({ compilerOptions: {} }) });
    expect(await detectAliasPrefix(root)).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });

  test("ignores a mapping that is not an alias root", async () => {
    const root = await project({
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "~/generated/*": ["./gen/*"] } } }),
    });

    // `~/generated` is a namespace, not where components should be written.
    expect(await detectAliasPrefix(root)).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });

  test("copes with a project that has no tsconfig at all", async () => {
    const root = await project({ "package.json": "{}" });
    expect(await detectAliasPrefix(root)).toBeUndefined();
    await rm(root, { recursive: true, force: true });
  });
});