import { createEffect } from "solid-js";

/** Marker attribute every roving item must carry. */
const ITEM = "[data-roving-item]";

export type RovingOrientation = "horizontal" | "vertical" | "both";

export interface RovingFocusOptions {
  /** Which arrow keys move focus. `"both"` handles menu/toolbar semantics. */
  orientation?: RovingOrientation;
  /** Wrap from last to first. On by default; off for `Tabs` with manual activation. */
  loop?: boolean;
  /**
   * Fire `onSelect` as focus moves (menus, toolbars, toggle groups).
   * Off for `Tabs`, where arrow keys move focus but Enter/Space selects.
   */
  selectOnFocus?: boolean;
  /** Which element holds `tabindex="0"` initially. Defaults to the first item. */
  initial?: HTMLElement | null;
  onSelect?: (element: HTMLElement) => void;
}

export interface RovingFocusHandle {
  /** Move focus (and tab stop) to an item, wherever it is in the list. */
  focusItem: (element: HTMLElement) => void;
  /** Element currently holding `tabindex="0"`. */
  active: () => HTMLElement | null;
}

function items(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  return Array.from(container.querySelectorAll<HTMLElement>(ITEM)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-disabled") !== "true" &&
      element.getClientRects().length > 0,
  );
}

/**
 * The roving-tabindex pattern: one item in the tab order, arrows move focus
 * between the rest.
 *
 * This is what keeps menus, tab lists and toggle groups a *single* tab stop
 * instead of one per option — the difference between "usable with a
 * keyboard" and "tab takes a hundred presses to cross the toolbar".
 */
export function rovingFocus(
  target: HTMLElement | (() => HTMLElement | null | undefined),
  options: RovingFocusOptions = {},
): RovingFocusHandle {
  // The container usually arrives after this call: a component runs its body
  // before the element its ref points at exists. Read it through a function
  // so every use below resolves at the moment it is needed.
  const container = (): HTMLElement | null =>
    typeof target === "function" ? (target() ?? null) : target;

  const orientation = options.orientation ?? "both";
  const loop = options.loop ?? true;

  let active: HTMLElement | null = null;

  const apply = (element: HTMLElement) => {
    for (const item of items(container())) {
      item.tabIndex = item === element ? 0 : -1;
    }
  };

  const focusItem = (element: HTMLElement) => {
    active = element;
    apply(element);
    element.focus({ preventScroll: true });
    if (options.selectOnFocus) options.onSelect?.(element);
  };

  const step = (from: HTMLElement, delta: number) => {
    const list = items(container());
    if (list.length === 0) return;

    const index = list.indexOf(from);
    if (index === -1) {
      focusItem(loop ? list[list.length - 1]! : list[0]!);
      return;
    }

    let next = index + delta;
    if (loop) next = (next + list.length) % list.length;
    else next = Math.min(Math.max(next, 0), list.length - 1);

    focusItem(list[next]!);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const horizontal = orientation === "horizontal" || orientation === "both";
    const vertical = orientation === "vertical" || orientation === "both";

    // Home/End jump to the ends, which is what people expect from a menu.
    if (event.key === "Home" || event.key === "End") {
      const list = items(container());
      if (list.length === 0) return;
      event.preventDefault();
      focusItem(event.key === "Home" ? list[0]! : list[list.length - 1]!);
      return;
    }

    const delta =
      (horizontal && event.key === "ArrowRight") || (vertical && event.key === "ArrowDown")
        ? 1
        : (horizontal && event.key === "ArrowLeft") || (vertical && event.key === "ArrowUp")
          ? -1
          : 0;

    if (delta === 0) return;
    const host = container();
    const current = (document.activeElement as HTMLElement | null) ?? active;
    if (!host || !current || !host.contains(current)) return;

    event.preventDefault();
    step(current, delta);
  };

  const onFocusIn = (event: FocusEvent) => {
    const element = event.target as HTMLElement | null;
    const host = container();
    if (!element || !host || !host.contains(element)) return;
    if (!element.matches(ITEM)) return;
    active = element;
    apply(element);
  };

  // Establish the single tab stop once items exist. Re-runs when the
  // container's children change, so a filtered menu keeps one tab stop.
  //
  // The listeners go up in the effect and come down in the value it returns —
  // `onCleanup` inside an effect's apply phase is not run on dispose in
  // Solid 2.
  createEffect(
    () => items(container()).length > 0,
    (hasItems) => {
      if (!hasItems) return;

      const host = container();
      if (!host) return;

      host.addEventListener("keydown", onKeyDown);
      host.addEventListener("focusin", onFocusIn);
      const list = items(host);
      if (list.length === 0) return;

      // `active` is a mutable closure variable, so the narrowing has to
      // happen through a local before it can be used as an element.
      const current = active;
      const stillMounted = current !== null && host.contains(current) && list.includes(current);
      const next = stillMounted ? current : (options.initial ?? list[0]!);
      active = next;
      apply(next);

      return () => {
        host.removeEventListener("keydown", onKeyDown);
        host.removeEventListener("focusin", onFocusIn);
      };
    },
  );

  return {
    focusItem,
    active: () => {
      const host = container();
      return active !== null && host !== null && host.contains(active) ? active : null;
    },
  };
}