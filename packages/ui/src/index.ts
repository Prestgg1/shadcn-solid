/**
 * `@prestgg/solid-ui` — public entry point.
 *
 * Import primitives directly when you want the whole set:
 *
 * ```ts
 * import { Button, Dialog, DialogRoot } from "@prestgg/solid-ui";
 * ```
 *
 * Or, after `solid-ui add button`, import just that component from your
 * own tree — the copy-paste model is the point, not an afterthought.
 */

// --- primitives ---------------------------------------------------------
export { cn, type ClassValue } from "./lib/cn";
export { split, has } from "./lib/split";
export { variants, type VariantSelection, type VariantsConfig, type VariantsFn } from "./lib/variants";
export { Portal, useEscapeKey } from "./lib/portal";
export { createPresence, type Presence } from "./lib/presence";
export {
  focusTrap,
  focusableWithin,
  type FocusTrapHandle,
  type FocusTrapOptions,
} from "./lib/focus-trap";
export { scrollLock } from "./lib/scroll-lock";
export {
  rovingFocus,
  type RovingFocusHandle,
  type RovingFocusOptions,
  type RovingOrientation,
} from "./lib/roving-focus";
export {
  floatingPanel,
  type FloatingHandle,
  type FloatingOptions,
  type FloatingState,
  type Placement,
} from "./lib/floating";
export { dismissable, type DismissableOptions } from "./lib/dismissable";
export { asChild } from "./lib/slot";
export { Polymorphic } from "./lib/polymorphic";