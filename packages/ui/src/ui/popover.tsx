import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { dismissable } from "~/lib/dismissable";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";

/**
 * Popover — a floating panel anchored to a trigger.
 *
 * ```tsx
 * <Popover>
 *   <PopoverTrigger>Options</PopoverTrigger>
 *   <PopoverContent align="start" sideOffset={4}>
 *     …
 *   </PopoverContent>
 * </Popover>
 * ```
 *
 * Unlike `Dialog` this is non-modal: the page behind stays interactive and
 * does not get locked, which is what makes a popover the right choice for a
 * filter menu or a settings cluster.
 *
 * Positioning is `@floating-ui/dom`, so the panel flips when there is no room
 * below and shifts along the cross axis rather than overflowing. It also
 * re-positions while the page scrolls, so the panel stays attached.
 */

interface PopoverContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  contentId: string;
}

const PopoverContext = createContext<PopoverContextValue>();

function usePopover(): PopoverContextValue {
  return useContext(PopoverContext);
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function Popover(props: PopoverProps): JSX.Element {
  const [local] = split(props, ["open", "defaultOpen", "onOpenChange", "children"]);

  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const isControlled = () => local.open !== undefined;
  const open = (): boolean => (isControlled() ? (local.open ?? false) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  let trigger: HTMLElement | undefined;

  return (
    <PopoverContext
      value={{
        open,
        setOpen,
        trigger: () => trigger,
        setTrigger: (element) => (trigger = element),
        contentId: `popover-${createUniqueId()}-content`,
      }}
    >
      {local.children}
    </PopoverContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function PopoverTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = usePopover();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "popover-trigger",
    "data-state": context.open() ? ("open" as const) : ("closed" as const),
    "aria-expanded": context.open() ? ("true" as const) : ("false" as const),
    "aria-haspopup": "dialog" as const,
    "aria-controls": context.open() ? context.contentId : undefined,
    class: cn(local.class),
    onClick: () => context.setOpen(!context.open()),
    // The trigger is also the positioning reference, so `asChild` has to
    // carry the ref along with the attributes.
    ref: (element: HTMLElement) => context.setTrigger(element),
  });

  return local.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <button {...attributes()} {...rest}>
          {local.children}
        </button>
      );
}

export interface PopoverContentProps extends PartProps {
  /** Which side of the trigger to sit on. */
  side?: Placement;
  /** Distance from the trigger, in pixels. */
  sideOffset?: number;
  /** Cross-axis alignment. */
  align?: "start" | "center" | "end";
  /** Render the placement arrow. */
  arrow?: boolean;
}

/** Resolve shadcn's `align` into a floating-ui placement. */
function placementOf(side: Placement, align: "start" | "center" | "end"): Placement {
  if (align === "center") return side;
  return `${side}-${align}` as Placement;
}

export function PopoverContent(props: PopoverContentProps): JSX.Element {
  const [local, rest] = split(props, [
    "class",
    "children",
    "asChild",
    "side",
    "sideOffset",
    "align",
    "arrow",
  ]);

  const context = usePopover();

  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "center";

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(
    () => context.trigger(),
    () => panel,
    context.open,
    {
      placement: placementOf(side(), align()),
      offset: local.sideOffset ?? 6,
      arrow: local.arrow,
    },
  );

  // The trigger is excluded from dismissal: pressing it while the panel is
  // open must close it, not close-and-immediately-reopen.
  dismissable(
    () => context.open(),
    () => context.setOpen(false),
    { inside: () => panel, outside: () => context.trigger() },
  );

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          // One ref doing both jobs: presence needs it to watch the exit
          // animation, and the positioner needs it to measure.
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="popover-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          data-align={align()}
          id={context.contentId}
          role="dialog"
          style={floating.style()}
          tabindex={-1}
          class={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          {...rest}
        >
          {local.children}
          <Show when={local.arrow}>
            <div
              data-slot="popover-arrow"
              aria-hidden="true"
              style={floating.arrowStyle()}
              class="absolute size-2.5 rotate-45 rounded-[2px] border bg-popover"
            />
          </Show>
        </div>
      </Portal>
    </Show>
  );
}

/** A labelled row inside the panel, clickable end to end. */
export function PopoverGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="popover-group"
      role="group"
      class={cn("flex w-full flex-col gap-1", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function PopoverSeparator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div data-slot="popover-separator" role="separator" class={cn("-mx-4 my-1 h-px bg-border", local.class)} {...rest} />
  );
}