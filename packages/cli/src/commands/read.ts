/**
 * Read-only commands: `list`, `view`, `search`.
 *
 * All three take `--plain`, which prints bare names or bare source with no
 * decoration. That is the mode an agent or a script wants; the default mode
 * is for a human at a terminal.
 */

import { bold, cyan, dim, log, plain, red } from "../utils/log";
import { resolveRegistry } from "../utils/registry";
import type { RegistryItemShape } from "../utils/types";

interface ReadOptions {
  cwd: string;
  registry?: string;
  plain?: boolean;
  type?: string;
}

interface ResolverOptions {
  cwd: string;
  registry?: string;
  namespaces?: Record<string, string>;
}

async function open(options: ResolverOptions) {
  return resolveRegistry({
    cwd: options.cwd,
    registry: options.registry,
    namespaces: options.namespaces,
  });
}

export async function list(options: ReadOptions): Promise<void> {
  const resolver = await open(options);
  const { items } = await resolver.index();

  const filtered = options.type ? items.filter((item) => item.type === options.type) : items;
  // Group by type, then name — so the output reads as a table of contents
  // rather than an alphabetical scatter.
  const sorted = [...filtered].sort(
    (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
  );

  if (options.plain) {
    for (const item of sorted) plain(item.name);
    return;
  }

  log();
  log(`${bold("registry")}  ${dim(resolver.source)}`);
  log();

  let currentType = "";
  for (const item of sorted) {
    if (item.type !== currentType) {
      if (currentType) log();
      currentType = item.type;
      log(cyan(currentType));
    }
    const description = item.description ?? "";
    plain(`  ${item.name.padEnd(24)} ${dim(description)}`);
  }

  log();
  plain(dim(`${sorted.length} item${sorted.length === 1 ? "" : "s"}`));
}

export async function view(
  name: string,
  options: ReadOptions & { docsOnly?: boolean; sourceOnly?: boolean },
): Promise<void> {
  const resolver = await open(options);
  const item = await resolver.item(name);

  if (options.docsOnly) {
    if (item.docs) {
      plain(item.docs);
      return;
    }
    log();
    plain(dim(`No documentation registered for "${item.name}".`));
    return;
  }

  if (!options.sourceOnly) {
    log();
    plain(bold(item.title ?? item.name));
    if (item.description) plain(item.description);
    if (item.dependencies?.length) plain(dim(`dependencies: ${item.dependencies.join(", ")}`));
    if (item.registryDependencies?.length) {
      plain(dim(`registry dependencies: ${item.registryDependencies.join(", ")}`));
    }
    log();

    if (item.docs) {
      plain(item.docs);
      log();
    }
  }

  plain(red("─".repeat(60)));
  for (const file of item.files) {
    log();
    plain(cyan(file.target ?? file.path));
    plain(red("─".repeat(60)));
    plain(file.content ?? "");
  }
}

export async function search(query: string, options: ReadOptions): Promise<void> {
  const resolver = await open(options);
  const { items } = await resolver.index();

  const needle = query.toLowerCase();
  const matches: RegistryItemShape[] = items.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) ||
      (item.title ?? "").toLowerCase().includes(needle) ||
      (item.description ?? "").toLowerCase().includes(needle),
  );

  if (options.plain) {
    for (const item of matches) plain(item.name);
    return;
  }

  log();
  if (matches.length === 0) {
    plain(dim(`No items match "${query}".`));
    log();
    return;
  }

  for (const item of matches) {
    plain(`${bold(item.name)}  ${dim(item.description ?? "")}`);
  }
  log();
}