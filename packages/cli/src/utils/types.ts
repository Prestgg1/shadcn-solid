/**
 * Registry wire shapes, mirrored from `@prestgg/solid-ui` so the CLI can run
 * before any component is installed.
 *
 * Field names match shadcn's registry protocol exactly — that is what lets
 * this CLI read a shadcn registry document and vice versa.
 */

export interface RegistryFile {
  /** Path inside the registry, relative to its root. */
  path: string;
  /** File contents. */
  content?: string;
  /** What the file is for. */
  type: string;
  /** Where to write it in the user's project. */
  target?: string;
}

export interface RegistryCssVars {
  theme?: Record<string, string>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

export interface RegistryItemShape {
  $schema?: string;
  name: string;
  /** `registry:ui`, `registry:lib`, `registry:hook`, … */
  type: string;
  title?: string;
  description?: string;
  /** npm packages this item needs. */
  dependencies?: string[];
  /** Other registry items that must land first. */
  registryDependencies?: string[];
  files: RegistryFile[];
  cssVars?: RegistryCssVars;
  /** Markdown reference, written for an LLM to read directly. */
  docs?: string;
  filesBasePath?: string;
}

export interface RegistryIndexShape {
  name?: string;
  homepage?: string;
  items: RegistryItemShape[];
}
