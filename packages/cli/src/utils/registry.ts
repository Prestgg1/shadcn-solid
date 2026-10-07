/**
 * Reading from a registry.
 *
 * Two sources, in order:
 *
 *   1. `@prestgg/solid-ui`'s own `registry.json`, found in `node_modules`
 *      — this is why installing the package is enough; no server needed.
 *   2. A URL, for anyone hosting a fork or a private namespace.
 *
 * `--registry` and the config's `registry` field select the source, and a
 * remote registry wins when explicitly given.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { RegistryIndexShape, RegistryItemShape } from "./types";

/** Mirror of the schema in `@prestgg/solid-ui`, kept local so the CLI has no runtime dep. */
export type { RegistryFile, RegistryItemShape, RegistryIndexShape } from "./types";

export interface RegistryResolver {
  index: () => Promise<RegistryIndexShape>;
  item: (name: string) => Promise<RegistryItemShape>;
  source: string;
}

function isIndex(value: unknown): value is RegistryIndexShape {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as RegistryIndexShape).items)
  );
}

/** Walk up from `cwd` looking for `node_modules/@prestgg/solid-ui/registry.json`. */
export function findLocalRegistry(cwd: string): string | null {
  let directory = resolve(cwd);

  for (;;) {
    const candidate = join(directory, "node_modules", "@prestgg", "solid-ui", "registry.json");
    if (existsSync(candidate)) return candidate;

    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

async function fromFile(path: string): Promise<RegistryResolver> {
  const index = JSON.parse(await readFile(path, "utf8")) as RegistryIndexShape;
  if (!isIndex(index)) throw new Error(`${path} is not a registry index.`);

  const byName = new Map(index.items.map((item) => [item.name, item]));

  return {
    source: path,
    async index() {
      return index;
    },
    async item(name) {
      const item = byName.get(name);
      if (!item) throw new Error(`No registry item named "${name}".`);
      return item;
    },
  };
}

async function fromUrl(url: string): Promise<RegistryResolver> {
  const base = url.endsWith("/") ? url : `${url}/`;

  const index = (await fetch(`${base}index.json`).then((response) => response.json())) as unknown;

  if (!isIndex(index)) throw new Error(`${base}index.json is not a registry index.`);

  const byName = new Map(index.items.map((item) => [item.name, item]));

  return {
    source: url,
    async index() {
      return index;
    },
    async item(name) {
      const known = byName.get(name);
      if (known) return known;
      const fetched = (await fetch(`${base}${name}.json`).then((response) =>
        response.json(),
      )) as RegistryItemShape;
      return fetched;
    },
  };
}

/**
 * A registry address: a bare name (`button`), a namespace (`@acme/table`) or
 * a URL to a JSON document.
 */
export function parseAddress(address: string): { name: string; registry?: string } {
  if (address.startsWith("@") && address.includes("/")) {
    const [namespace, ...rest] = address.split("/");
    return { name: rest.join("/"), registry: namespace!.slice(1) };
  }

  if (address.startsWith("http://") || address.startsWith("https://")) {
    return { name: address, registry: undefined };
  }

  return { name: address };
}

/** Resolve the registry to read from. Explicit `--registry` always wins. */
export async function resolveRegistry(options: {
  cwd: string;
  registry?: string;
  /** Named registries from `components.json`. */
  namespaces?: Record<string, string>;
}): Promise<RegistryResolver> {
  if (options.registry) {
    const { name } = parseAddress(options.registry);

    // A direct document URL: fetch the item itself.
    if (name.startsWith("http")) {
      const url = new URL(name);
      const namespace = options.namespaces?.[url.host];
      if (namespace) return fromUrl(namespace);
      return fromUrl(name.replace(/\/[^/]+$/, ""));
    }

    const base = options.namespaces?.[name];
    if (base) return fromUrl(base);
  }

  const local = findLocalRegistry(options.cwd);
  if (local) return fromFile(local);

  throw new Error(
    [
      "No registry found.",
      "",
      "Install the package first:",
      "  bun add @prestgg/solid-ui",
      "",
      "or point at one explicitly:",
      "  solid-ui add button --registry https://shadcn-solid.dev/r",
    ].join("\n"),
  );
}

