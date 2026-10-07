import type { RegistryItem } from "./schema";

/**
 * The item manifest.
 *
 * This file is the registry's source of truth for *structure* — which
 * components exist, what each one needs, which files it is. The contents of
 * those files are read from disk at build time, so an item is never
 * duplicated between a manifest and a file on disk.
 *
 * Order matters for humans reading this file; the CLI sorts by name.
 */
export const ui: RegistryItem[] = [];

/** Shared code that items import but do not carry themselves. */
export const lib: RegistryItem[] = [
  {
    name: "cn",
    type: "registry:lib",
    title: "cn",
    description: "Class-name merger built on clsx and tailwind-merge. Every component uses it.",
    dependencies: ["clsx", "tailwind-merge"],
    files: [{ path: "lib/cn.ts", type: "lib", target: "lib/cn.ts" }],
  },
  {
    name: "variants",
    type: "registry:lib",
    title: "variants",
    description: "cva-compatible variant function, without the dependency.",
    registryDependencies: ["cn"],
    files: [{ path: "lib/variants.ts", type: "lib", target: "lib/variants.ts" }],
  },
];

/** Hooks and DOM primitives that overlay and menu components share. */
export const hooks: RegistryItem[] = [
  {
    name: "presence",
    type: "registry:hook",
    title: "createPresence",
    description: "Keeps a subtree mounted until its exit animation has played.",
    files: [{ path: "lib/presence.ts", type: "hook", target: "lib/presence.ts" }],
  },
  {
    name: "focus-trap",
    type: "registry:hook",
    title: "focusTrap",
    description: "Confines Tab to a container and restores focus when it closes.",
    files: [{ path: "lib/focus-trap.ts", type: "hook", target: "lib/focus-trap.ts" }],
  },
  {
    name: "scroll-lock",
    type: "registry:hook",
    title: "scrollLock",
    description: "Reference-counted body scroll lock for nested overlays.",
    files: [{ path: "lib/scroll-lock.ts", type: "hook", target: "lib/scroll-lock.ts" }],
  },
  {
    name: "roving-focus",
    type: "registry:hook",
    title: "rovingFocus",
    description: "The roving-tabindex pattern for menus, tabs and toggle groups.",
    files: [{ path: "lib/roving-focus.ts", type: "hook", target: "lib/roving-focus.ts" }],
  },
  {
    name: "floating",
    type: "registry:hook",
    title: "floatingPanel",
    description: "Positioning for popovers, menus and selects, via @floating-ui/dom.",
    dependencies: ["@floating-ui/dom"],
    registryDependencies: ["presence"],
    files: [{ path: "lib/floating.tsx", type: "hook", target: "lib/floating.tsx" }],
  },
  {
    name: "dismissable",
    type: "registry:hook",
    title: "dismissable",
    description: "Close-on-outside-press and Escape, safe inside nested overlays.",
    files: [{ path: "lib/dismissable.ts", type: "hook", target: "lib/dismissable.ts" }],
  },
  {
    name: "portal",
    type: "registry:hook",
    title: "Portal",
    description: "Render into document.body, resolved lazily so SSR is safe.",
    files: [{ path: "lib/portal.tsx", type: "hook", target: "lib/portal.tsx" }],
  },
];

/** The stylesheet `init` writes and every component's classes assume. */
export const styles: RegistryItem[] = [
  {
    name: "index",
    type: "registry:style",
    title: "Base styles",
    description: "Design tokens, the Tailwind v4 theme mapping, and the overlay keyframes.",
    files: [{ path: "styles/index.css", type: "style", target: "styles/index.css" }],
  },
];

export const items: RegistryItem[] = [...lib, ...hooks, ...ui, ...styles];