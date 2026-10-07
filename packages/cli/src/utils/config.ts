/**
 * `components.json` — shadcn's config format, unchanged.
 *
 * Field names are deliberately identical to shadcn's own file: a project
 * that already ran `shadcn init` can be pointed at this registry without
 * touching its config, and a team moving between the two CLIs reads the
 * same file.
 */

export interface ComponentsConfig {
  $schema?: string;
  /** Named style preset. Kept for shadcn compatibility; this registry ships one. */
  style: string;
  /** React Server Components. Always false here — Solid has no RSC. */
  rsc: false;
  /** Whether components are TypeScript. Always true here. */
  tsx: true;
  tailwind: {
    /** Path to a Tailwind config file. Null means Tailwind v4 CSS-first. */
    config: string | null;
    css: string;
    baseColor: string;
    cssVariables: boolean;
    /** Prefix for every generated Tailwind class. Empty by default. */
    prefix: string;
  };
  aliases: {
    components: string;
    utils: string;
    ui: string;
    lib: string;
    hooks: string;
  };
  /** Named third-party registries, addressed as `@namespace/item`. */
  registries?: Record<string, string>;
  /** URL of the registry this project pulls components from. */
  registry?: string;
}

export const CONFIG_FILE = "components.json";

export const DEFAULT_CONFIG: ComponentsConfig = {
  style: "default",
  rsc: false,
  tsx: true,
  tailwind: {
    config: null,
    css: "src/app.css",
    baseColor: "neutral",
    cssVariables: true,
    prefix: "",
  },
  aliases: {
    components: "@/components",
    utils: "@/lib/utils",
    ui: "@/components/ui",
    lib: "@/lib",
    hooks: "@/hooks",
  },
};

/**
 * Merge a config found on disk over the defaults. Missing keys are filled in
 * rather than rejected, so a config written by an older CLI still works.
 */
export function normalizeConfig(value: unknown): ComponentsConfig {
  const partial = (typeof value === "object" && value !== null ? value : {}) as Partial<
    ComponentsConfig
  >;

  return {
    ...DEFAULT_CONFIG,
    ...partial,
    rsc: false,
    tsx: true,
    tailwind: { ...DEFAULT_CONFIG.tailwind, ...partial.tailwind },
    aliases: { ...DEFAULT_CONFIG.aliases, ...partial.aliases },
    registries: { ...DEFAULT_CONFIG.registries, ...partial.registries },
  };
}