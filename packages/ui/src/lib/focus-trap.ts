import { createEffect } from "solid-js";

/**
 * Selector for everything that can hold keyboard focus. `[tabindex="-1"]`
 * is excluded on purpose: programmatically focusable is not the same as
 * tab-reachable, and letting it into the cycle breaks Shift+Tab.
 */
const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Elements that opted into being focused first when the trap opens. */
const AUTOFOCUS = "[data-autofocus]";

/** Tag names that can hold focus without a `tabindex`. */
const NATIVELY_FOCUSABLE = /^(a|area|button|input|select|textarea|iframe|object|embed|audio|video|summary)$/i;

function isNativelyFocusable(element: HTMLElement): boolean {
  return NATIVELY_FOCUSABLE.test(element.tagName) || element.isContentEditable;
}

/** Elements a user has explicitly dismissed, which must stay dismissed. */
const DISMISSED = "[data-focus-trap-dismissed]";

export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => {
    if (element.hasAttribute("disabled")) return false;
    // A focusable element can still opt out of the tab cycle, and
    // `tabindex="-1"` on a <button> still matches the button selector above.
    if (element.getAttribute("tabindex") === "-1") return false;
    if (element.closest(DISMISSED) && !element.hasAttribute(DISMISSED)) return false;
    // `aria-hidden` and `inert` are inherited: a button inside a hidden
    // wrapper is just as unreachable as one hidden itself.
    if (element.closest('[aria-hidden="true"]') !== null) return false;
    if (element.closest("[inert]") !== null) return false;
    // `offsetParent` is null for `display: none` and `position: fixed`;
    // fall back to the rect so fixed elements still count.
    if (element.offsetParent !== null) return true;
    return element.getClientRects().length > 0;
  });
}

export interface FocusTrapOptions {
  /**
   * Focus the container itself instead of its first child. Use it when the
   * first focusable is a close button: focusing "Close" is correct for a
   * destructive confirmation, wrong for a form.
   */
  focusContainer?: boolean;
  /** Called instead of the default focus move. Return `true` if handled. */
  initialFocus?: (container: HTMLElement) => HTMLElement | null | undefined;
  /** Element to focus when the container has nothing focusable. */
  fallbackFocus?: HTMLElement | null;
}

export interface FocusTrapHandle {
  /** Move focus back to whatever was active before the trap opened. */
  restore: () => void;
  /** Focus the container's first focusable (or the container). */
  focus: () => void;
}

/**
 * Active traps, oldest first. Only the last one reacts.
 *
 * Without this, two overlapping overlays fight: each trap's `focusin` pulls
 * focus to its own container, which fires `focusin` in the other, forever.
 * That is not only a test artefact — a dialog that opens a sheet leaves the
 * dialog's trap enabled underneath it, which is the commonest way two
 * modals meet.
 */
const activeTraps: symbol[] = [];

/**
 * Confine Tab and Shift+Tab to `container` while `enabled()` is true, and
 * restore focus to the previously active element when it stops.
 *
 * Focus that escapes by other means (a click on the page behind, a
 * programmatic `focus()` elsewhere) is pulled back on `focusin`, which is
 * what makes the trap actually hold rather than merely cycle.
 */
export function focusTrap(
  container: HTMLElement | (() => HTMLElement | null | undefined),
  enabled: () => boolean,
  options: FocusTrapOptions = {},
): FocusTrapHandle {
  // The container can arrive after the call: an overlay renders its panel
  // inside a `<Show>`, so the ref is unset when this runs. A function is read
  // on every pass instead, which re-targets the trap when the panel remounts.
  const element = (): HTMLElement | null =>
    typeof container === "function" ? (container() ?? null) : container;

  /**
   * Focus to restore when the trap closes. Captured when the trap *opens*,
   * not when it is constructed — a component that builds its trap while
   * hidden has nothing meaningful to restore to otherwise.
   */
  let previous: HTMLElement | null = null;
  const token = Symbol("focus-trap");

  const focus = () => {
    if (typeof document === "undefined") return;
    const container = element();
    if (!container) return;

    // Resolution order, most explicit first:
//   1. a caller-supplied `initialFocus`
//   2. the container itself, when `focusContainer` was asked for
//   3. an element that opted in with `[data-autofocus]`
//   4. the first focusable descendant
const target =
  options.initialFocus?.(container) ??
  (options.focusContainer ? container : null) ??
  container.querySelector<HTMLElement>(AUTOFOCUS) ??
  focusableWithin(container)[0] ??
  options.fallbackFocus ??
  container;

    // A plain container is not focusable until it carries a tabindex. `-1`
    // keeps it out of the tab cycle while still letting us move focus onto
    // it — which is what makes "focus the panel, not the close button" work.
    if (!target.hasAttribute("tabindex") && !isNativelyFocusable(target)) {
      target.setAttribute("tabindex", "-1");
    }

    target.focus({ preventScroll: true });
  };

  /** True while this trap is the innermost active one. */
  const isTop = (): boolean => activeTraps[activeTraps.length - 1] === token;

  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled() || !isTop() || event.key !== "Tab") return;
    const container = element();
    if (!container) return;

    const items = focusableWithin(container);
    if (items.length === 0) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }

    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const onFocusIn = (event: FocusEvent) => {
    // Only the innermost trap reacts; see `activeTraps`.
    if (!enabled() || !isTop()) return;
    const container = element();
    if (!container) return;

    const target = event.target as Node | null;
    if (target && container.contains(target)) return;
    if (target !== previous) {
      event.stopPropagation();
      focus();
    }
  };

  const restore = () => {
    if (!previous || !previous.isConnected) return;
    previous.focus({ preventScroll: true });
  };

  // Two-phase effect: `enabled()` is tracked in the compute phase, and the
  // focus move happens in the apply phase. Solid 1 ran both in one pass.
  //
  // The listeners are installed here and *not* through `onCleanup`: in Solid
  // 2 a cleanup registered inside an effect's apply phase does not run when
  // the root is disposed. The value the apply phase returns is the teardown,
  // and that is what Solid actually calls.
  createEffect(
    () => (element() ? enabled() : false),
    (active) => {
      // The apply phase runs on every pass, including the first, so the gate
      // lives here rather than in the compute.
      if (!active) return;

      // Read at open time, so restoring lands on the trigger rather than on
      // whatever was focused when the component was constructed.
      previous = typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null);

      activeTraps.push(token);
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("focusin", onFocusIn, true);
      focus();

      return () => {
        const at = activeTraps.indexOf(token);
        if (at !== -1) activeTraps.splice(at, 1);
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("focusin", onFocusIn, true);
        restore();
      };
    },
  );

  return { restore, focus };
}