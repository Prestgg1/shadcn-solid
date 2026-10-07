import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import prompts from "prompts";

import { resolveAlias, targetDirectory } from "../utils/alias";
import { CONFIG_FILE, DEFAULT_CONFIG, normalizeConfig, type ComponentsConfig } from "../utils/config";
import { error, info, log, success, warn } from "../utils/log";
import { parseAddress, resolveRegistry, type RegistryResolver } from "../utils/registry";
import type { RegistryItemShape } from "../utils/types";

interface AddOptions {
  cwd: string;
  yes: boolean;
  all: boolean;
  overwrite: boolean;
  registry?: string;
  silent?: boolean;
}

/** Read `components.json`, or explain what `init` is for. */
export async function loadConfig(cwd: string): Promise<ComponentsConfig> {
  const path = join(cwd, CONFIG_FILE);
  if (!existsSync(path)) {
    throw new Error(
      `No ${CONFIG_FILE} in ${cwd}. Run \`solid-ui init\` first, or pass --cwd to the right directory.`,
    );
  }
  return normalizeConfig(JSON.parse(await readFile(path, "utf8")));
}

async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

/**
 * Write one registry file into the project.
 *
 * Existing files are never silently replaced: that is the whole point of
 * the copy-paste model. Without `--overwrite` the file is left alone and the
 * skip is reported, so `add` can be re-run safely after local edits.
 */
async function writeFileIntoProject(
  cwd: string,
  config: ComponentsConfig,
  file: { target?: string; path: string; content?: string; type: string },
  overwrite: boolean,
): Promise<"written" | "skipped" | "unchanged"> {
  if (typeof file.content !== "string") return "skipped";

  const directory = await targetDirectory(cwd, config, file.type);
  const name = file.target?.split("/").pop() ?? file.path.split("/").pop();
  if (!name) return "skipped";

  const destination = resolve(directory, name);

  if (existsSync(destination)) {
    const current = await readFile(destination, "utf8");
    if (current === file.content) return "unchanged";
    if (!overwrite) return "skipped";
  }

  await ensureParent(destination);
  await writeFile(destination, file.content, "utf8");
  return "written";
}

/**
 * Collect an item plus everything it depends on, depth first.
 *
 * `registryDependencies` is what makes `add dialog` pull in `button` without
 * the user naming it, and what makes `add form` pull in the field pieces.
 */
async function collect(
  resolver: RegistryResolver,
  names: string[],
): Promise<RegistryItemShape[]> {
  const seen = new Set<string>();
  const collected: RegistryItemShape[] = [];

  const visit = async (name: string): Promise<void> => {
    if (seen.has(name)) return;
    seen.add(name);

    let item: RegistryItemShape;
    try {
      item = await resolver.item(name);
    } catch {
      warn(`Unknown item "${name}" — skipped.`);
      return;
    }

    for (const dependency of item.registryDependencies ?? []) {
      await visit(dependency);
    }

    collected.push(item);
  };

  for (const name of names) await visit(name);
  return collected;
}

/** Split `a, b c` into names, so the CLI accepts both separators. */
function splitAddresses(input: string[]): string[] {
  return input
    .flatMap((value) => value.split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

async function installDependencies(
  cwd: string,
  dependencies: string[],
  yes: boolean,
): Promise<void> {
  if (dependencies.length === 0) return;

  const detected = await detectPackageManager(cwd);

  log();
  info(`Installing ${dependencies.length} dependencies with ${detected}:`);
  info(`  ${dependencies.join(", ")}`);
  log();

  if (!yes) {
    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: "Install these packages?",
      initial: true,
    });
    if (!proceed) {
      warn("Skipped. Install them yourself before using the components.");
      return;
    }
  }

  const command = installCommand(detected, dependencies);
  const result = await run(command, cwd);
  if (result !== 0) error(`${detected} exited with ${result}. Install the dependencies manually.`);
}

type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

async function detectPackageManager(cwd: string): Promise<PackageManager> {
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function installCommand(manager: PackageManager, packages: string[]): string {
  const list = packages.join(" ");
  switch (manager) {
    case "bun":
      return `bun add ${list}`;
    case "pnpm":
      return `pnpm add ${list}`;
    case "yarn":
      return `yarn add ${list}`;
    case "npm":
      return `npm install ${list}`;
  }
}

async function run(command: string, cwd: string): Promise<number> {
  const [program, ...args] = command.split(" ");
  const child = Bun.spawn([program!, ...args], { cwd, stdout: "inherit", stderr: "inherit" });
  return await child.exited;
}

export async function add(names: string[], options: AddOptions): Promise<void> {
  const cwd = resolve(options.cwd);
  const config = await loadConfig(cwd);

  const addresses = splitAddresses(names);
  if (addresses.length === 0) {
    throw new Error("Tell me what to add: `solid-ui add button dialog`.");
  }

  const plain = addresses.map((address) => parseAddress(address).name);
  const resolver = await resolveRegistry({
    cwd,
    registry: options.registry ?? config.registry,
    namespaces: config.registries,
  });

  const items = await collect(resolver, plain);
  if (items.length === 0) {
    throw new Error(`Nothing matched: ${addresses.join(", ")}`);
  }

  log();
  info(`Adding ${items.length} item${items.length === 1 ? "" : "s"} from ${resolver.source}`);
  for (const item of items) {
    info(`  ${item.name}${item.description ? ` — ${item.description}` : ""}`);
  }
  log();

  let written = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const item of items) {
    for (const file of item.files) {
      const outcome = await writeFileIntoProject(cwd, config, file, options.overwrite);
      if (outcome === "written") {
        written += 1;
        const directory = await targetDirectory(cwd, config, file.type);
        const name = file.target?.split("/").pop() ?? file.path.split("/").pop();
        success(`${relative(cwd, resolve(directory, name ?? ""))}`);
      } else if (outcome === "unchanged") {
        unchanged += 1;
      } else if (options.overwrite) {
        unchanged += 1;
      } else {
        skipped += 1;
        const name = file.target?.split("/").pop() ?? file.path.split("/").pop();
        warn(`${name} already exists and differs — skipped. Pass --overwrite to replace.`);
      }
    }
  }

  log();
  if (skipped > 0) {
    info(`${written} written, ${unchanged} already current, ${skipped} skipped.`);
  } else {
    info(`${written} written, ${unchanged} already current.`);
  }

  if (options.silent) return;

  const dependencies = [...new Set(items.flatMap((item) => item.dependencies ?? []))];
  if (dependencies.length > 0) {
    await installDependencies(cwd, dependencies, options.yes);
  }
}

/** `solid-ui init` — write the config, the stylesheet and the `cn` helper. */
export async function init(options: { cwd: string; yes: boolean }): Promise<void> {
  const cwd = resolve(options.cwd);

  if (!existsSync(join(cwd, "package.json"))) {
    throw new Error(`No package.json in ${cwd}. Run this from a project root.`);
  }

  const answers: Partial<Record<"css" | "ui" | "lib", string>> = options.yes
    ? {}
    : await prompts([
        {
          type: "text",
          name: "css",
          message: "Where is your global CSS?",
          initial: DEFAULT_CONFIG.tailwind.css,
        },
        {
          type: "text",
          name: "ui",
          message: "Where should components live?",
          initial: DEFAULT_CONFIG.aliases.ui,
        },
        {
          type: "text",
          name: "lib",
          message: "Where should shared helpers live?",
          initial: DEFAULT_CONFIG.aliases.lib,
        },
      ]);

  const config: ComponentsConfig = normalizeConfig({
    ...DEFAULT_CONFIG,
    tailwind: {
      ...DEFAULT_CONFIG.tailwind,
      css: answers.css ?? DEFAULT_CONFIG.tailwind.css,
    },
    aliases: {
      ...DEFAULT_CONFIG.aliases,
      ui: answers.ui ?? DEFAULT_CONFIG.aliases.ui,
      lib: answers.lib ?? DEFAULT_CONFIG.aliases.lib,
    },
  });

  await writeFile(join(cwd, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8");
  success(`${CONFIG_FILE}`);

  // The stylesheet carries the tokens every component's classes assume, so
  // `init` cannot be skipped — but we only create it if it is missing.
  const cssPath = resolve(cwd, config.tailwind.css);
  if (!existsSync(cssPath)) {
    await ensureParent(cssPath);
    await writeFile(
      cssPath,
      ['@import "tailwindcss";', "", '/* @prestgg/solid-ui tokens */', '@import "@prestgg/solid-ui/styles.css";', ""].join("\n"),
      "utf8",
    );
    success(config.tailwind.css);
  } else {
    info(`${config.tailwind.css} already exists — add \`@import "@prestgg/solid-ui/styles.css";\` to it.`);
  }

  // `cn` is required by every component, so it is written here rather than
  // made the user's first `add`. The alias names a module, not a directory,
  // so the extension is ours to supply.
  const utilsPath = resolve(cwd, `${await resolveAlias(cwd, config.aliases.utils)}.ts`);
  await mkdir(dirname(utilsPath), { recursive: true });
  await writeFile(
    utilsPath,
    [
      'import { clsx, type ClassValue } from "clsx";',
      'import { extendTailwindMerge } from "tailwind-merge";',
      "",
      "const twMerge = extendTailwindMerge({});",
      "",
      "export function cn(...inputs: ClassValue[]) {",
      "  return twMerge(clsx(inputs));",
      "}",
      "",
      "export type { ClassValue };",
      "",
    ].join("\n"),
    "utf8",
  );
  success(relative(cwd, utilsPath));

  log();
  info("Next: `solid-ui add button`");
}