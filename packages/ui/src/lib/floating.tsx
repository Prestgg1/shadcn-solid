import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  limitShift,
  offset,
  shift,
  size,
  type Middleware,
  type Placement,
} from "@floating-ui/dom";
import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { createPresence } from "./presence";

export type { Placement };

/** Where a floating panel sits relative to its anchor. */
export interface FloatingOptions {
  /** `side-align`, matching shadcn's prop names. */
  placement?: Placement;
  /** Gap between anchor and panel, in pixels. shadcn's `sideOffset`. */
  offset?: number;
  /** Flip to the opposite side when there is not enough room. On by default. */
  flip?: boolean;
  /** Slide along the cross axis to stay on screen. On by default. */
  shift?: boolean;
  /** Match the panel's width to the anchor (`Select` needs this). */
  sameWidth?: boolean;
  /** Shrink the panel to the available space instead of overflowing. */
  fitViewport?: boolean;
  /** A single element (not a function) to render the placement arrow in. */
  arrow?: boolean;
}

/** Placement data the component tree binds to. */
export interface FloatingState {
  x: Accessor<number>;
  y: Accessor<number>;
  placement: Accessor<Placement>;
  /** False when the anchor scrolled out of view and the panel was hidden. */
  visible: Accessor<boolean>;
  /** Middleware data for the arrow element, if `arrow` is on. */
  arrow: Accessor<{ x?: number; y?: number } | undefined>;
}

export interface FloatingHandle extends FloatingState {
  /** Styles to spread on the panel: fixed position plus a max size. */
  style: Accessor<Record<string, string>>;
  /** Styles for the arrow: a translate on a small absolutely-placed element. */
  arrowStyle: Accessor<Record<string, string>>;
  /** Mount window for the panel; the size middleware needs a real element. */
  presence: ReturnType<typeof createPresence>;
  /** Stop tracking. Called automatically on cleanup. */
  stop: () => void;
}

/** Build the middleware stack for the given options. */
function middleware(options: FloatingOptions): Middleware[] {
  const list: Middleware[] = [];

  list.push(offset(options.offset ?? 6));

  if (options.flip !== false) list.push(flip({ padding: 8 }));

  if (options.shift !== false) {
    list.push(
      shift({
        padding: 8,
        limiter: options.fitViewport ? limitShift() : undefined,
      }),
    );
  }

  if (options.sameWidth) {
    list.push(
      size({
        padding: 8,
        apply({ elements, rects, availableHeight, availableWidth }) {
          Object.assign(elements.floating.style, {
            minWidth: `${Math.round(rects.reference.width)}px`,
            maxWidth: `${Math.round(availableWidth)}px`,
            maxHeight: `${Math.round(availableHeight)}px`,
          });
        },
      }),
    );
  }

  list.push(hide({ strategy: "referenceHidden" }));

  return list;
}

/**
 * Position a panel against an anchor with `@floating-ui/dom`, exposed
 * through Solid signals.
 *
 * `autoUpdate` keeps the placement correct while either element moves or
 * resizes — the piece hand-rolled positioning usually gets wrong, where a
 * filtered dropdown stays at the height it had when it opened.
 *
 * ```ts
 * const floating = floatingPanel(() => anchorRef, () => panelRef, () => open(), {
 *   placement: "bottom-start",
 *   sameWidth: true,
 * });
 * <div ref={floating.style()}>…</div>
 * ```
 *
 * The panel is mounted by {@link createPresence} first, so the flip/size
 * middlewares have a real element to measure.
 */
export function floatingPanel(
  reference: Accessor<Element | null | undefined>,
  floating: Accessor<HTMLElement | null | undefined>,
  open: Accessor<boolean>,
  options: FloatingOptions = {},
): FloatingHandle {
  const presence = createPresence(open);
  const [x, setX] = createSignal(0);
  const [y, setY] = createSignal(0);
  const [placement, setPlacement] = createSignal<Placement>(options.placement ?? "bottom");
  const [visible, setVisible] = createSignal(true);
  const [arrowData, setArrowData] = createSignal<{ x?: number; y?: number } | undefined>(
    undefined,
  );

  let stopTracking: (() => void) | undefined;

  /** Recompute once. Registered with `autoUpdate`, which calls it once on setup. */
  const update = async () => {
    const anchor = reference();
    const panel = floating();
    if (!anchor || !panel) return;

    const result = await computePosition(anchor, panel, {
      placement: options.placement ?? "bottom",
      middleware: middleware(options),
    });

    setX(result.x);
    setY(result.y);
    setPlacement(result.placement);
    setVisible(result.middlewareData.hide?.referenceHidden !== true);
    setArrowData(
      options.arrow
        ? (result.middlewareData.arrow as { x?: number; y?: number } | undefined)
        : undefined,
    );
  };

  /**
   * Attach position tracking. Kept separate from `update` because
   * `autoUpdate` invokes its callback immediately on setup — calling it
   * from inside `update` would recurse forever.
   *
   * Tracking re-runs on scroll, resize and element resize, which is what
   * keeps a filtered dropdown the height it is now rather than the height
   * it had when it opened. No `animationFrame` loop: a permanent rAF per
   * open panel costs more than the occasional reposition.
   */
  const track = () => {
    const anchor = reference();
    const panel = floating();
    if (!anchor || !panel) return;

    stopTracking?.();
    stopTracking = autoUpdate(anchor, panel, update);
  };

  createEffect(() => {
    // Reading both signals re-runs this across a full open/close cycle,
    // which is when a stale measurement would otherwise show up.
    presence.mounted();
    if (!open()) {
      stopTracking?.();
      stopTracking = undefined;
      return;
    }
    track();
  });

  onCleanup(() => stopTracking?.());

  const style = (): Record<string, string> => ({
    position: "fixed",
    left: "0",
    top: "0",
    transform: `translate(${Math.round(x())}px, ${Math.round(y())}px)`,
    visibility: visible() ? "visible" : "hidden",
    "pointer-events": visible() ? "auto" : "none",
  });

  const arrowStyle = (): Record<string, string> => {
    const data = arrowData();
    if (!data) return {};
    const horizontal = placement().startsWith("top") || placement().startsWith("bottom");
    return horizontal
      ? { left: `${data.x ?? 0}px`, top: "", transform: "translate(-50%, -50%)" }
      : { top: `${data.y ?? 0}px`, left: "", transform: "translate(-50%, -50%)" };
  };

  return {
    x,
    y,
    placement,
    visible,
    arrow: arrowData,
    style,
    arrowStyle,
    presence,
    stop: () => stopTracking?.(),
  };
}