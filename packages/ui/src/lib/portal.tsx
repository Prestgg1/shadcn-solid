import { Portal as SolidPortal } from "solid-js/web";
import type { JSX, ParentProps } from "solid-js";
import { Show, createEffect, createSignal, onCleanup } from "solid-js";

/**
 * Render children into `document.body`.
 *
 * The portal target is resolved lazily on mount, which keeps the component
 * usable under SSR (SolidStart prerender, static export) where `document`
 * does not exist during module evaluation.
 */
export function Portal(props: ParentProps<{ mount?: HTMLElement | null }>) {
  const [target, setTarget] = createSignal<HTMLElement | null>(props.mount ?? null);

  createEffect(() => {
    if (props.mount !== undefined) {
      setTarget(props.mount);
      return;
    }
    if (typeof document === "undefined") return;
    setTarget(document.body);
  });

  return (
    <Show when={target()}>
      {(node) => <SolidPortal mount={node()}>{props.children}</SolidPortal>}
    </Show>
  );
}

/** Props every overlay root shares. */
export interface OverlayRootProps {
  /** Renders the overlay. Kept as a prop so mounting can be delayed. */
  open?: boolean;
  /** Called on close requests: Escape, scrim click, outside pointer-down. */
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
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
  createEffect(() => {
    if (!enabled()) return;
    if (typeof document === "undefined") return;

    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (options.stopPropagation) event.stopPropagation();
      event.preventDefault();
      onEscape();
    };

    document.addEventListener("keydown", handler, options.capture ?? false);
    onCleanup(() => document.removeEventListener("keydown", handler, options.capture ?? false));
  });
}