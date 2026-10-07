import { type Element, Show, createEffect, createSignal } from "solid-js";
import { Portal as SolidPortal } from "@solidjs/web";

/**
 * Render children into `document.body`.
 *
 * The portal target is resolved lazily on mount, which keeps the component
 * usable during server rendering, where `document` does not exist.
 */
export function Portal(props: {
  mount?: HTMLElement | null;
  children?: Element;
}): Element {
  const [target, setTarget] = createSignal<HTMLElement | null>(props.mount ?? null);

  createEffect(
    () => (props.mount === undefined ? typeof document !== "undefined" : true),
    () => {
      if (props.mount !== undefined) setTarget(props.mount);
      else if (typeof document !== "undefined") setTarget(document.body);
    },
  );

  return (
    <Show when={target()} keyed>
      {(node) => <SolidPortal mount={node}>{props.children}</SolidPortal>}
    </Show>
  );
}

/**
 * Escape-to-close, wired to `document` so it works no matter where focus
 * currently sits.
 *
 * `stopPropagation` is opt-in because nested overlays need it: pressing
 * Escape inside a popover that lives inside a dialog should close only the
 * popover.
 */
export function useEscapeKey(
  enabled: () => boolean,
  onEscape: () => void,
  options: { capture?: boolean; stopPropagation?: boolean } = {},
): void {
  createEffect(
    () => enabled() && typeof document !== "undefined",
    (active) => {
      if (!active || typeof document === "undefined") return;

      const handler = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        if (options.stopPropagation) event.stopPropagation();
        event.preventDefault();
        onEscape();
      };

      document.addEventListener("keydown", handler, options.capture ?? false);
      return () => document.removeEventListener("keydown", handler, options.capture ?? false);
    },
  );
}