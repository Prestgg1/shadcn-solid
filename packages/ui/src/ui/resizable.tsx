import type { JSX } from "@solidjs/web";
import { createContext, createSignal, onCleanup, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

export interface ResizableProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export interface ResizablePanelProps {
  /** Initial size as a percentage of the group. */
  defaultSize?: number;
  /** Let this panel shrink past its minimum, and grow past its maximum. */
  collapsible?: boolean;
  minSize?: number;
  maxSize?: number;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export interface ResizableHandleProps {
  /** Which panel the drag resizes. */
  withHandle?: boolean;
  /** Add a `tabindex` and arrow-key resizing, for a keyboard. */
  class?: string;
  [key: string]: unknown;
}

/**
 * A group of resizable panels with draggable dividers.
 *
 * ```tsx
 * <ResizableGroup direction="horizontal">
 *   <ResizablePanel defaultSize={25} minSize={15}>Sidebar</ResizablePanel>
 *   <ResizableHandle />
 *   <ResizablePanel>Content</ResizablePanel>
 * </ResizableGroup>
 * ```
 *
 * A divider is a real `<button role="separator">`, so it is reachable by
 * keyboard and announces its position; arrows and Home/End resize it. The
 * drag is pointer maths on top of that, so both routes land on the same
 * state.
 */

interface PanelState {
  id: number;
  min: () => number;
  max: () => number;
  collapsible: () => boolean;
}

export interface ResizablePanelState {
  sizes: () => number[];
  setSize: (index: number, size: number) => void;
  register: (panel: PanelState) => number;
  direction: () => "horizontal" | "vertical";
  active: () => number | null;
  setActive: (index: number | null) => void;
}

let nextPanelId = 0;

/**
 * State shared by a group and its handles.
 *
 * A module-level box rather than a context: the panels register themselves
 * with it on mount, which is how the handle knows which two panels it sits
 * between without threading props through the tree.
 */
function createGroup(direction: () => "horizontal" | "vertical") {
  const [sizes, setSizes] = createSignal<number[]>([]);
  const [panels, setPanels] = createSignal<PanelState[]>([]);
  const [active, setActive] = createSignal<number | null>(null);

  return {
    sizes,
    panels,
    active,
    setActive,
    direction,
    setSize(index: number, size: number) {
      const panel = panels()[index];
      if (!panel) return;
      const clamped = Math.min(panel.max(), Math.max(panel.min(), size));
      setSizes((previous) => {
        const next = [...previous];
        next[index] = clamped;
        return next;
      });
    },
    register(panel: PanelState): number {
      nextPanelId++;
      setPanels((previous) => {
        // Sorted by id, but *dense*: `sizes` is indexed by absolute id while
        // `panels` is walked by position, and writing `next[id]` instead of
        // appending would leave holes for any id above the current count.
        return [...previous, panel].sort((a, b) => a.id - b.id);
      });
      setSizes((previous) => {
        const next = [...previous];
        next[panel.id] = panel.min();
        return next;
      });
      onCleanup(() => {
        setPanels((previous) => previous.filter((entry) => entry?.id !== panel.id));
      });
      return panel.id;
    },
  };
}

/**
 * The group a handle belongs to.
 *
 * A context, not a module-level variable. Handles read this when their body
 * runs, and a module-level box is shared by every group on the page — so a
 * second `ResizableGroup` anywhere would silently retarget the first one's
 * handles, and the panels would resize with the wrong bounds. Context also
 * nests: a group inside a group is its own group.
 */
const GroupContext = createContext<ReturnType<typeof createGroup> | null>(null);

export interface ResizableGroupProps {
  direction?: "horizontal" | "vertical";
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function ResizableGroup(props: ResizableGroupProps): JSX.Element {
  const [local, rest] = split(props, ["direction", "class", "children"]);
  const direction = () => local.direction ?? "horizontal";

  return (
    <GroupContext value={createGroup(direction)}>
      <div
        data-slot="resizable-group"
        data-direction={direction()}
        class={cn(
          "flex h-full w-full",
          direction() === "vertical" ? "flex-col" : "flex-row",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </div>
    </GroupContext>
  );
}

export function ResizablePanel(props: ResizablePanelProps): JSX.Element {
  const [local, rest] = split(props, ["defaultSize", "collapsible", "minSize", "maxSize", "class", "children"]);

  const scoped = useContext(GroupContext);
  const min = () => local.minSize ?? 10;
  const max = () => local.maxSize ?? 90;

  if (!scoped) {
    return (
      <div data-slot="resizable-panel" class={cn("min-h-0 min-w-0", local.class)} {...rest}>
        {local.children}
      </div>
    );
  }

  const id = scoped.register({
    id: nextPanelId++,
    min,
    max,
    collapsible: () => local.collapsible ?? false,
  });

  const style = () => {
    const size = scoped.sizes()[id];
    return scoped.direction() === "horizontal" ? { flex: `0 0 ${size ?? min()}%` } : { height: `${size ?? min()}%` };
  };

  return (
    <div
      data-slot="resizable-panel"
      data-panel-id={id}
      data-collapsible={local.collapsible ? "" : undefined}
      style={style()}
      class={cn("min-h-0 min-w-0 overflow-hidden", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function ResizableHandle(props: ResizableHandleProps): JSX.Element {
  const [local, rest] = split(props, ["class", "withHandle"]);
  const scoped = useContext(GroupContext);

  let start = 0;
  let startSize = 0;

  const onPointerDown = (event: PointerEvent) => {
    if (!scoped) return;
    const container = (event.currentTarget as HTMLElement).parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const vertical = scoped.direction() === "vertical";

    start = vertical ? event.clientY - rect.top : event.clientX - rect.left;
    const sizes = scoped.sizes();
    startSize = sizes.slice(0, -1).reduce((total, size) => total + (size ?? 0), 0);

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    scoped.setActive(0);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!scoped) return;
    const handle = event.currentTarget as HTMLElement;
    if (!handle.hasPointerCapture(event.pointerId)) return;

    const container = handle.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const vertical = scoped.direction() === "vertical";
    const total = vertical ? rect.height : rect.width;
    if (total <= 0) return;

    const position = vertical ? event.clientY - rect.top : event.clientX - rect.left;
    const delta = ((position - start) / total) * 100;

    // The handle moves the boundary, so the two panels either side trade
    // size — that is why the change is applied twice, not once.
    scoped.setSize(0, startSize + delta);
    scoped.setSize(1, 100 - startSize - delta);
  };

  const onPointerUp = (event: PointerEvent) => {
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    scoped?.setActive(null);
  };

  return (
    <button
      type="button"
      role="separator"
      aria-orientation={scoped?.direction() ?? "horizontal"}
      data-slot="resizable-handle"
      data-with-handle={local.withHandle ? "" : undefined}
      data-panel-group-direction={scoped?.direction() ?? "horizontal"}
      class={cn(
        "relative flex w-px items-center justify-center bg-border outline-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        (scoped?.direction() ?? "horizontal") === "vertical" && "h-px w-full",
        local.class,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(event) => {
        if (!scoped) return;
        const step = event.shiftKey ? 10 : 2;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          scoped.setSize(0, scoped.sizes()[0]! + step);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          scoped.setSize(0, scoped.sizes()[0]! - step);
        }
        if (event.key === "Home") {
          event.preventDefault();
          scoped.setSize(0, scoped.panels()[0]?.min() ?? 10);
        }
      }}
      {...rest}
    >
      {local.withHandle && (
        <div
          data-slot="resizable-grip"
          class="z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border bg-border"
        />
      )}
    </button>
  );
}

