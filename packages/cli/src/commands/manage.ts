/**
 * `solid-ui remove` and `solid-ui diff`.
 *
 * Both work off the files themselves rather than a manifest: a project is
 * supposed to keep working after it is copied into, so the tool has to be
 * able to recognise its own output in a tree that has been edited since.
 */

import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { loadConfig } from "./add";
import { targetDirectory } from "../utils/alias";
import { info, log, success, warn } from "../utils/log";
import { resolveRegistry } from "../utils/registry";
import type { RegistryItemShape } from "../utils/types";

interface FileOptions {
  cwd: string;
  overwrite: boolean;
  registry?: string;
  silent?: boolean;
}

/** Registry file kinds, and where each kind lands in a project. */
const FILE_KINDS = ["ui", "lib", "hook", "style"] as const;

/** The registry marker every copied file starts with. */
const MARKER = /^\s*(?:\/\/|\/\*)\s*registry:([a-z0-9-]+)\s*(\*\/|\*)?\s*$/m;

interface Located {
  path: string;
  contents: string;
}

/** Find every file under `root` this CLI wrote, and say which item it came from. */
async function scan(root: string): Promise<Located[]> {
  const found: Located[] = [];

  const walk = async (directory: string): Promise<void> => {
    if (!existsSync(directory)) return;

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!/\.(ts|tsx|css)$/.test(entry.name)) continue;

      const contents = await readFile(path, "utf8");
      if (MARKER.test(contents)) found.push({ path, contents });
    }
  };

  await walk(root);
  return found;
}

/** Flatten overlapping scans, keeping the first sighting of each path. */
function dedupe(scans: Located[][]): Located[] {
  const seen = new Set<string>();
  const out: Located[] = [];

  for (const entry of scans.flat()) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    out.push(entry);
  }

  return out;
}

async function itemsFor(options: { cwd: string; registry?: string }): Promise<RegistryItemShape[]> {
  const config = await loadConfig(options.cwd);
  const resolver = await resolveRegistry({
    cwd: options.cwd,
    registry: options.registry ?? config.registry,
    namespaces: config.registries,
  });
  const { items } = await resolver.index();
  return items;
}

/**
 * Which registry item a copied file belongs to.
 *
 * Read from the header the installer writes, not guessed from the filename: a
 * file the user renamed stays recognisable as long as the marker is intact,
 * and `card.tsx` is no longer ambiguous once `card-header.tsx` exists.
 */
function ownerOf(file: Located, items: RegistryItemShape[]): RegistryItemShape | undefined {
  const name = /registry:([a-z0-9-]+)/i.exec(file.contents)?.[1];
  if (!name) return undefined;
  return items.find((item) => item.name === name);
}

export async function remove(names: string[], options: FileOptions): Promise<void> {
  const cwd = resolve(options.cwd);
  const items = await itemsFor(options);
  const config = await loadConfig(cwd);
  const roots = await Promise.all(
    FILE_KINDS.map((type) => targetDirectory(cwd, config, type)),
  );

  // The roots overlap: the stylesheet's directory is usually `src`, which
  // contains the others. Dedupe by path so a file is only acted on once.
  const files = dedupe(await Promise.all(roots.map((root) => scan(root))));
  const wanted = new Set(names);

  const targets = files.filter((file) => {
    const owner = ownerOf(file, items);
    return owner !== undefined && wanted.has(owner.name);
  });

  if (targets.length === 0) {
    log();
    info("Nothing matched. Files this CLI created are recognised by a registry marker.");
    return;
  }

  for (const file of targets) {
    await rm(file.path);
    success(relative(cwd, file.path));
  }

  log();
  warn(
    "Left formatting and tokens alone on purpose — `init` may have shared them with your own code.",
  );
}

export async function diff(names: string[], options: FileOptions): Promise<void> {
  const cwd = resolve(options.cwd);
  const items = await itemsFor(options);
  const config = await loadConfig(cwd);
  const roots = await Promise.all(
    FILE_KINDS.map((type) => targetDirectory(cwd, config, type)),
  );

  const files = dedupe(await Promise.all(roots.map((root) => scan(root))));
  const byFile = new Map(files.map((file) => [file.path.split("/").pop() ?? "", file]));
  const wanted = names.length > 0 ? new Set(names) : null;

  let changed = 0;
  log();

  for (const item of items) {
    if (wanted && !wanted.has(item.name)) continue;

    for (const candidate of item.files) {
      const name = candidate.target?.split("/").pop() ?? candidate.path.split("/").pop();
      if (!name) continue;

      const local = byFile.get(name);
      const upstream = candidate.content;

      if (!local) {
        info(`${item.name}/${name} — not installed`);
        continue;
      }
      if (upstream === undefined || local.contents === upstream) continue;

      changed += 1;
      log(`${info(`${item.name}/${name} — differs`)}`);
      for (const line of differenceAt(local.contents, upstream)) log(`    ${line}`);
    }
  }

  if (changed === 0) {
    log();
    info("Everything installed matches the registry.");
    return;
  }

  log();
  info(`${changed} file${changed === 1 ? "" : "s"} differ. Review, then copy over what you want —`);
  info("or re-install with `solid-ui add --overwrite`.");
}

/**
 * A minimal unified diff of the first differing region.
 *
 * Deliberately small: `diff` exists to answer "has this file drifted, and
 * where", not to be `git diff`. The full file is always available from
 * `solid-ui view`.
 */
function differenceAt(local: string, upstream: string): string[] {
  const a = local.split("\n");
  const b = upstream.split("\n");

  let line = 0;
  while (line < a.length && line < b.length && a[line] === b[line]) line += 1;

  return [
    `line ${line + 1}`,
    `- ${a[line]?.trim() ?? "(end of file)"}`,
    `+ ${b[line]?.trim() ?? "(end of file)"}`,
  ];
}
