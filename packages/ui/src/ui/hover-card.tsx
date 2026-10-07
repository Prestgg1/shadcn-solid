import type { JSX } from "@solidjs/web";
import {
  Show,
  createContext,
  createSignal,
  createUniqueId,
  onCleanup,
  useContext,
} from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { dismissable } from "~/lib/dismissable";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";

/**
 * HoverCard — a preview panel shown on hover.
 *
 * ```tsx
 * <HoverCard openDelay={200} closeDelay={100}>
 *   <HoverCardTrigger href="/posts/1">Read more</HoverCardTrigger>
 *   <HoverCardContent>
 *     <HoverCardTitle>Shipping with Solid 2</HoverCardTitle>
 *     <HoverCardDescription>…</HoverCardDescription>
 *   </HoverCardContent>
 * </HoverCard>
 * ```
 *
 * Both delays are the point. A tooltip's counterpart (`Tooltip`) opens
 * immediately, because its content is the label the trigger already needs;
 * a hover card is *extra* content, so opening it on the same frame as the
 * pointer makes it flash at every element the cursor crosses on the way
 * somewhere. The defaults here — 200ms in, 100ms out — are the short
 * enough to feel instant, long enough not to flicker.
 *
 * The close delay exists for the same reason in reverse: it gives the
 * pointer time to travel from the trigger into the panel, which is what
 * makes reading and clicking inside the card possible at all.
 */

interface HoverCardContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  contentId: string;
  scheduleOpen: () => void;
  scheduleClose: () => void;
  cancelScheduledClose: () => void;
  /** Drop pending timers, so an unmounted card cannot reopen. */
  cancelTimers: () => void;
}

const HoverCardContext = createContext<HoverCardContextValue>();

function useHoverCard(): HoverCardContextValue {
  return useContext(HoverCardContext);
}

export interface HoverCardProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Milliseconds of hover before the card opens. `200` by default. */
  openDelay?: number;
  /** Milliseconds after the pointer leaves before it closes. `100` by default. */
  closeDelay?: number;
  children?: JSX.Element;
}

export function HoverCard(props: HoverCardProps): JSX.Element {
  const [local] = split(props, [
    "open",
    "defaultOpen",
    "onOpenChange",
    "openDelay",
    "closeDelay",
    "children",
  ]);

  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const isControlled = () => local.open !== undefined;
  const open = (): boolean => (isControlled() ? (local.open ?? false) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  let trigger: HTMLElement | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelTimers = () => {
    if (openTimer !== undefined) clearTimeout(openTimer);
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    openTimer = undefined;
    closeTimer = undefined;
  };

  const scheduleOpen = () => {
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    closeTimer = undefined;
    if (openTimer !== undefined) return;
    openTimer = setTimeout(() => {
      openTimer = undefined;
      setOpen(true);
    }, local.openDelay ?? 200);
  };

  const scheduleClose = () => {
    if (openTimer !== undefined) clearTimeout(openTimer);
    openTimer = undefined;
    if (closeTimer !== undefined) return;
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, local.closeDelay ?? 100);
  };

  const cancelScheduledClose = () => {
    if (closeTimer === undefined) return;
    clearTimeout(closeTimer);
    closeTimer = undefined;
  };

  // A pending timer outliving the component would set a signal on a disposed
  // root — and reopen a card whose owner is gone.
  onCleanup(cancelTimers);

  return (
    <HoverCardContext
      value={{
        open,
        setOpen: (next) => {
          // An explicit `setOpen` — from a click, or from the controlled prop
          // — is a decision, so pending hover timers must not override it.
          cancelTimers();
          setOpen(next);
        },
        trigger: () => trigger,
        setTrigger: (element) => (trigger = element),
        contentId: `hover-card-${createUniqueId()}-content`,
        scheduleOpen,
        scheduleClose,
        cancelScheduledClose,
        cancelTimers,
      }}
    >
      {local.children}
    </HoverCardContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function HoverCardTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "href"]);
  const context = useHoverCard();

  const attributes = () => ({
    "data-slot": "hover-card-trigger",
    "data-state": context.open() ? ("open" as const) : ("closed" as const),
    "aria-describedby": context.open() ? context.contentId : undefined,
    class: cn(local.class),
    onPointerenter: () => context.scheduleOpen(),
    onPointerleave: () => context.scheduleClose(),
    onFocus: () => context.scheduleOpen(),
    onBlur: () => context.scheduleClose(),
    ref: (element: HTMLElement) => context.setTrigger(element),
  });

  // An `<a>` by default: a hover card usually previews a destination, so the
  // thing being hovered is the link to it.
  return local.asChild ? (
    asChild(() => local.children ?? null, attributes)
  ) : (
    <a href={local.href as string | undefined} {...attributes()} {...rest}>
      {local.children}
    </a>
  );
}

export interface HoverCardContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function HoverCardContent(props: HoverCardContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "side", "sideOffset", "align"]);

  const context = useHoverCard();

  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "center";

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(
    () => context.trigger(),
    () => panel,
    context.open,
    {
      placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
      offset: local.sideOffset ?? 8,
      flip: false,
    },
  );

  // A press elsewhere dismisses immediately — no close delay, because the
  // user has already committed to going somewhere else.
  dismissable(
    () => context.open(),
    () => context.setOpen(false),
    { inside: () => panel, outside: () => context.trigger() },
  );

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="hover-card-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          data-align={align()}
          id={context.contentId}
          role="dialog"
          style={floating.style()}
          class={cn(
            "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          // Hovering the card keeps it open — the close delay alone cannot
          // carry the pointer across the gap.
          onPointerEnter={() => context.cancelScheduledClose()}
          onPointerLeave={() => context.scheduleClose()}
          {...rest}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
}

export function HoverCardTitle(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <h4 data-slot="hover-card-title" class={cn("text-sm font-semibold", local.class)} {...rest}>
      {local.children}
    </h4>
  );
}

export function HoverCardDescription(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <p
      data-slot="hover-card-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
}