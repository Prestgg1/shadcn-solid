/**
 * Registry item schema.
 *
 * Wire-compatible with shadcn's own registry: the same `registry:*` type
 * names, the same field names, the same `@namespace/item` addressing. That
 * is what lets the CLI fetch a React registry for styles or tokens while
 * serving Solid components itself.
 */

export const REGISTRY_TYPES = [
  "registry:lib",
  "registry:hook",
  "registry:ui",
  "registry:block",
  "registry:example",
  "registry:page",
  "registry:component",
  "registry:theme",
  "registry:style",
  "registry:internal",
] as const;

export type RegistryType = (typeof REGISTRY_TYPES)[number];

/** What a file inside an item is for. Drives `target` and the CLI's copy behaviour. */
export const REGISTRY_FILE_TYPES = ["lib", "hook", "ui", "block", "example", "page", "component", "theme", "style", "internal"] as const;

export type RegistryFileType = (typeof REGISTRY_FILE_TYPES)[number];

export interface RegistryFile {
  /** Path inside the package, relative to the registry root. */
  path: string;
  /** File contents. Absent for generated items (a stylesheet assembled from variables). */
  content?: string;
  type: RegistryFileType;
  /** Where to write it in the user's project, relative to `aliases.ui` / `src`. */
  target?: string;
}

export interface RegistryCssVars {
  theme?: Record<string, string>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: RegistryType;
  title?: string;
  description?: string;
  /** npm packages to install. Only what this item genuinely needs. */
  dependencies?: string[];
  /** Other registry items that must land first. Resolved transitively. */
  registryDependencies?: string[];
  files: RegistryFile[];
  cssVars?: RegistryCssVars;
  /**
   * Markdown, in the shape an LLM can use directly: what it is, what it
   * accepts, how to use it. Generated from the source, never hand-written
   * twice.
   */
  docs?: string;
  /** Prefix this item's files with, e.g. `registry-ui/button-`. */
  filesBasePath?: string;
}

export interface RegistryIndex {
  name: string;
  homepage: string;
  items: RegistryItem[];
}

/** Marker written at the top of every copied file, used by `diff` and `remove`. */
export const REGISTRY_MARKER = "registry:";

/** Dependency-free validator, so the CLI can run before zod is installed. */
export function isRegistryItem(value: unknown): value is RegistryItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<RegistryItem>;
  return (
    typeof item.name === "string" &&
    typeof item.type === "string" &&
    (REGISTRY_TYPES as readonly string[]).includes(item.type) &&
    Array.isArray(item.files)
  );
}