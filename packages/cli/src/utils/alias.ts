/**
 * Resolving an alias to a real directory.
 *
 * `components.json` speaks in aliases (`@/components/ui`) because that is
 * what a project's `tsconfig` understands. Writing files needs a path on
 * disk, so aliases are resolved against the project root and any configured
 * path mapping.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { ComponentsConfig } from "./config";

/** Read `tsconfig.json` (or `jsconfig.json`) and collect its path mappings. */
async function readPathAliases(cwd: string): Promise<Record<string, string>> {
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;

    try {
      // `extends` and comments make JSON.parse unreliable here; the aliases
      // we need live under `compilerOptions.paths`.
      const text = await readFile(path, "utf8");
      const paths = /"paths"\s*:\s*\{([^}]*)\}/.exec(text)?.[1];
      if (!paths) return {};

      const aliases: Record<string, string> = {};
      const pattern = /"([^"]+)"\s*:\s*\[([^\]]*)\]/g;
      let match = pattern.exec(paths);

      while (match) {
        const [, alias, values] = match;
        const first = /"([^"]+)"/.exec(values ?? "")?.[1];
        if (alias && first) aliases[alias] = first;
        match = pattern.exec(paths);
      }

      return aliases;
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Turn a config alias into a project-relative path.
 *
 * An alias like `@/components/ui` becomes `src/components/ui` when the
 * tsconfig maps a wildcard to `src`, so the CLI writes where the project
 * actually resolves imports.
 */
export async function resolveAlias(cwd: string, alias: string): Promise<string> {
  const aliases = await readPathAliases(cwd);

  const match = Object.entries(aliases).find(([pattern]) => {
    const star = pattern.indexOf("*");
    if (star === -1) return pattern === alias;
    return alias.startsWith(pattern.slice(0, star)) && alias.endsWith(pattern.slice(star + 1));
  });

  if (!match) return alias.replace(/^[@~.]{1,2}\//, "").replace(/^@/, "");

  const [pattern, target] = match;
  const star = pattern.indexOf("*");

  if (star === -1) return target;

  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  const middle = alias.slice(prefix.length, alias.length - suffix.length || undefined);
  const base = target.slice(0, target.indexOf("*"));

  return resolve(cwd, `${base}${middle}`);
}

/** The directory a file of `type` belongs in, given the project's aliases. */
export async function targetDirectory(
  cwd: string,
  config: ComponentsConfig,
  type: string,
): Promise<string> {
  switch (type) {
    case "ui":
      return resolveAlias(cwd, config.aliases.ui);
    case "hook":
      return resolveAlias(cwd, config.aliases.hooks);
    case "lib":
      return resolveAlias(cwd, config.aliases.lib);
    case "style":
      return config.tailwind.css;
    default:
      return resolveAlias(cwd, config.aliases.components);
  }
}