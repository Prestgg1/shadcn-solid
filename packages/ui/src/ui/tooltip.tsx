import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";

/**
 * Tooltip — a short label for an element that has no visible text.
 *
 * ```tsx
 * <Tooltip>
 *   <TooltipTrigger asChild><Button>Save</Button></TooltipTrigger>
 *   <TooltipContent>Save changes</TooltipContent>
 * </Tooltip>
 * ```
 *
 * Opens with no delay: the content is the label the trigger is missing, so
 * waiting would just make the control read as unlabelled for a moment. It
 * opens on focus as well as hover, and Escape dismisses it — a tooltip that
 * only appears on hover is invisible to keyboard users.
 *
 * Use `HoverCard` instead when the content is a preview or a link rather
 * than a label: a tooltip cannot be hovered or clicked, which is exactly
 * what makes it safe to dismiss on the way out.
 */

interface TooltipContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  contentId: string;
}

const TooltipContext = createContext<TooltipContextValue>();

function useTooltip(): TooltipContextValue {
  return useContext(TooltipContext);
}

export interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function Tooltip(props: TooltipProps): JSX.Element {
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
    <TooltipContext
      value={{
        open,
        setOpen,
        trigger: () => trigger,
        setTrigger: (element) => (trigger = element),
        contentId: `tooltip-${createUniqueId()}-content`,
      }}
    >
      {local.children}
    </TooltipContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function TooltipTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useTooltip();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") context.setOpen(false);
  };

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "tooltip-trigger",
    "data-state": context.open() ? ("open" as const) : ("closed" as const),
    "aria-describedby": context.open() ? context.contentId : undefined,
    class: cn(local.class),
    onPointerenter: () => context.setOpen(true),
    onPointerleave: () => context.setOpen(false),
    onFocus: () => context.setOpen(true),
    onBlur: () => context.setOpen(false),
    onKeydown: onKeyDown,
    // The trigger is the positioning reference; `asChild` carries it along.
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

export interface TooltipContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function TooltipContent(props: TooltipContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "side", "sideOffset", "align"]);

  const context = useTooltip();

  const side = (): Placement => local.side ?? "top";
  const align = () => local.align ?? "center";

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(
    () => context.trigger(),
    () => panel,
    context.open,
    {
      placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
      offset: local.sideOffset ?? 4,
    },
  );

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="tooltip-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          data-align={align()}
          id={context.contentId}
          role="tooltip"
          style={floating.style()}
          class={cn(
            "z-50 w-fit max-w-xs rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          {...rest}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
}

export interface TooltipProviderProps {
  children?: JSX.Element;
}

/**
 * Wraps tooltips that live in a portal-mounted subtree.
 *
 * Present for API parity with Radix, where a global provider carries the
 * skip-delay duration for every tooltip on the page. Here each tooltip is
 * already independent, so this only forwards its children — keep it if you
 * are porting, drop it if you are not.
 */
export function TooltipProvider(props: TooltipProviderProps): JSX.Element {
  return <>{props.children}</>;
}