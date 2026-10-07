import { createEffect, onCleanup } from "solid-js";

export interface DismissableOptions {
  /** Inside this element counts as "inside", so content can own its own stops. */
  inside: () => Element | null | undefined;
  /** Outside this element. When given, only presses in it dismiss. */
  outside?: () => Element | null | undefined;
  /** Close on pointer-down outside. On by default. */
  pointerDown?: boolean;
  /** Close on Escape. On by default. */
  escape?: boolean;
  /**
   * Stop the Escape event from reaching ancestors. Required when the panel
   * can sit inside another overlay — otherwise one Esc closes both.
   */
  stopEscape?: boolean;
}

/**
 * Close a floating panel on outside pointer-down or Escape.
 *
 * Listens on `pointerdown` in the capture phase rather than `click`, so a
 * press that starts inside and ends outside still dismisses — which is what
 * a user expects from a dropdown they dragged away from.
 *
 * ```ts
 * dismissable(() => open(), () => setOpen(false), {
 *   inside: () => panelRef,
 *   outside: () => triggerRef,   // a press on the trigger must not dismiss
 * });
 * ```
 */
export function dismissable(
  enabled: () => boolean,
  close: () => void,
  options: DismissableOptions,
): void {
  createEffect(() => {
    if (!enabled()) return;
    if (typeof document === "undefined") return;

    const { inside, outside, pointerDown = true, escape = true, stopEscape = true } = options;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (inside()?.contains(target)) return;
      // Presses on the trigger must not dismiss, or clicking the trigger
      // twice would close the panel and immediately reopen it.
      if (outside && outside()?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (stopEscape) event.stopPropagation();
      event.preventDefault();
      close();
    };

    if (pointerDown) document.addEventListener("pointerdown", onPointerDown, true);
    if (escape) document.addEventListener("keydown", onKeyDown, true);

    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    });
  });
}