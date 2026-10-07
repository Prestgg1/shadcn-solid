/**
 * The registry, read at build time.
 *
 * The docs site and the CLI consume the same `registry.json`, so a
 * component page cannot describe something the installer does not ship. The
 * import is `with { type: "json" }` rather than a fetch: the file is in the
 * repository, and a build that silently reads a stale HTTP copy is worse
 * than one that fails loudly.
 */

import registry from "../../../packages/ui/registry.json" with { type: "json" };

export interface RegistryFile {
  path: string;
  type: string;
  target?: string;
  content?: string;
}

export interface RegistryItem {
  name: string;
  type: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
}

export interface Registry {
  name: string;
  homepage: string;
  items: RegistryItem[];
}

const index = registry as unknown as Registry;

/** Components, alphabetically — the order the docs sidebar uses. */
export const components: RegistryItem[] = index.items
  .filter((item) => item.type === "registry:ui")
  .sort((a, b) => a.name.localeCompare(b.name));

/** The primitives components are built on. */
export const primitives: RegistryItem[] = index.items
  .filter((item) => item.type === "registry:lib" || item.type === "registry:hook")
  .sort((a, b) => a.name.localeCompare(b.name));

export function findItem(name: string): RegistryItem | undefined {
  return index.items.find((item) => item.name === name);
}

/** Files with `registry:` stripped, as they appear in a project. */
export function sourcesOf(item: RegistryItem): { name: string; code: string }[] {
  return item.files.map((file) => ({
    name: (file.target ?? file.path).split("/").pop() ?? file.path,
    // The installer prepends a marker line; a reader does not need it.
    code: (file.content ?? "").replace(/^\s*(?:\/\/|\/\*)\s*registry:[a-z0-9-]+\s*(?:\*\/)?\n/i, ""),
  }));
}

export const counts = {
  components: components.length,
  primitives: primitives.length,
  items: index.items.length,
};