/**
 * Build the registry from the manifest.
 *
 * Reads every file named in `registry-ui.ts` from disk, attaches its
 * contents, and writes:
 *
 *   registry.json      the index the CLI lists components from
 *   registry/<n>.json  one document per item, addressed by name
 *   llms.txt           an index for agents
 *   llms-full.txt      every component's docs in one file
 *
 * Run with `bun run registry`.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { items } from "../registry/registry-ui";
import type { RegistryIndex, RegistryItem } from "../registry/schema";

const here = dirname(fileURLToPath(import.meta.url));
/** `src/scripts` → the package root. */
const packageRoot = resolve(here, "..", "..");
const sourceRoot = resolve(packageRoot, "src");
const outDir = resolve(packageRoot, "registry");

const HOMEPAGE = "https://shadcn-solid.dev";

/**
 * The header an already-marked file carries: one line naming the registry
 * item, which is all `remove` and `diff` need.
 */
const MARKER_LINE = /^\s*(?:\/\/|\/\*)\s*registry:/m;

/** Prefix every copied file with the item's registry type, shadcn-style. */
function basePathFor(item: RegistryItem): string {
  const segment = item.type.replace("registry:", "");
  return `registry-${segment}/${item.name}`;
}

async function readFileOrFail(path: string, itemName: string): Promise<string> {
  const absolute = resolve(sourceRoot, path);
  try {
    return await readFile(absolute, "utf8");
  } catch {
    throw new Error(
      `Registry item "${itemName}" points at a file that does not exist:\n  ${absolute}`,
    );
  }
}

function withContents(source: RegistryItem, contents: string[]): RegistryItem {
  const filesBasePath = basePathFor(source);

  return {
    $schema: "https://shadcn-solid.dev/schema/registry-item.json",
    ...source,
    filesBasePath,
    files: source.files.map((file, index) => ({
      ...file,
      target: file.target ?? `${filesBasePath}/${file.path.split("/").pop() ?? index}`,
      content: contents[index] ?? "",
    })),
  };
}

/** The `llms.txt` header every line of the index is written against. */
function llmsIndex(list: RegistryIndex): string {
  const ui = list.items
    .filter((entry) => entry.type === "registry:ui")
    .map((entry) => `- \`${entry.name}\`: ${entry.description ?? entry.title ?? ""}`)
    .join("\n");

  const primitives = list.items
    .filter((entry) => entry.type === "registry:lib" || entry.type === "registry:hook")
    .map((entry) => `- \`${entry.name}\`: ${entry.description ?? ""}`)
    .join("\n");

  return [
    "# @prestgg/solid-ui",
    "",
    "> shadcn/ui for SolidJS. Components are copied into your project, not imported.",
    "",
    `Install: \`bun add @prestgg/solid-ui solid-js\``,
    `Add a component: \`bunx solid-ui@latest add button dialog\``,
    "",
    "## Documentation",
    "",
    `- Full component reference with props and examples: ${HOMEPAGE}/docs/components`,
    `- Every component in one file: ${HOMEPAGE}/llms-full.txt`,
    `- CLI reference: ${HOMEPAGE}/docs/cli`,
    "",
    "## Primitives",
    "",
    ui || "_No UI components registered yet._",
    "",
    "## Internal primitives",
    "",
    primitives || "_None._",
    "",
  ].join("\n");
}

function llmsFull(list: RegistryIndex): string {
  const sections = list.items
    .filter((entry) => entry.type === "registry:ui" || entry.type === "registry:lib" || entry.type === "registry:hook")
    .map((entry) => {
      const heading = `# ${entry.name}`;
      const description = entry.description ? `\n${entry.description}` : "";
      const deps = entry.dependencies?.length ? `\n\nDependencies: ${entry.dependencies.join(", ")}` : "";
      return `${heading}\n${description}${deps}\n`;
    });

  return ["# @prestgg/solid-ui — full component reference", "", ...sections].join("\n");
}

async function main() {
  const built: RegistryItem[] = [];

  for (const source of items) {
    const contents = await Promise.all(
      source.files.map((file) => readFileOrFail(file.path, source.name)),
    );
    built.push(withContents(source, contents));
  }

  // Every copied file carries its registry item in the first line. That is
  // what lets `solid-ui remove` and `solid-ui diff` recognise their own
  // output in a tree the user has since edited, without a manifest.
  for (const item of built) {
    for (const file of item.files) {
      if (file.content === undefined) continue;
      if (MARKER_LINE.test(file.content)) continue;
      const comment = file.path.endsWith(".css") ? "/*" : "//";
      file.content = `${comment} registry:${item.name}\n${file.content}`;
    }
  }

  const index: RegistryIndex = { name: "solid-ui", homepage: HOMEPAGE, items: built };

  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

  // One document per item, so the CLI can fetch a single component without
  // downloading the whole registry — the same layout shadcn serves at /r.
  await Promise.all(
    built.map((entry) =>
      writeFile(resolve(outDir, `${entry.name}.json`), `${JSON.stringify(entry, null, 2)}\n`),
    ),
  );

  await writeFile(resolve(packageRoot, "registry.json"), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(resolve(packageRoot, "llms.txt"), llmsIndex(index));
  await writeFile(resolve(packageRoot, "llms-full.txt"), llmsFull(index));

  const counts = built.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.type] = (accumulator[entry.type] ?? 0) + 1;
    return accumulator;
  }, {});

  console.log(`registry: ${built.length} items → ${outDir}`);
  for (const [type, count] of Object.entries(counts).sort()) {
    console.log(`  ${type.padEnd(18)} ${count}`);
  }
}

await main();