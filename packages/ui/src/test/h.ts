import type { Component, JSX } from "solid-js";
import { createComponent } from "solid-js/web";

/**
 * Build a Solid element without JSX.
 *
 * `h(Button, { children: "Save" })` is `createComponent(Button, …)`, which
 * is exactly what Solid's JSX compiler emits. Tests use it because Bun's
 * automatic JSX runtime targets React, and the Solid transform that would
 * be needed runs from a preload — after the entry file is parsed.
 *
 * The cast is confined to this one bridge; every component keeps its own
 * props type at the call site.
 */
export function h<P extends object>(component: Component<P>, props: P): JSX.Element {
  return createComponent(
    component as Component<Record<string, unknown>>,
    props as unknown as Record<string, unknown>,
  );
}
