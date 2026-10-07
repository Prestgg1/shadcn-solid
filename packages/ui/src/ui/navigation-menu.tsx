import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";
import { asChild } from "~/lib/slot";

/**
 * NavigationMenu — a list of links with panels that fly out of the item.
 *
 * ```tsx
 * <NavigationMenu>
 *   <NavigationMenuList>
 *     <NavigationMenuItem>
 *       <NavigationMenuTrigger>Products</NavigationMenuTrigger>
 *       <NavigationMenuContent>
 *         <NavigationMenuLink href="/analytics">Analytics</NavigationMenuLink>
 *         <NavigationMenuLink href="/reports">Reports</NavigationMenuLink>
 *       </NavigationMenuContent>
 *     </NavigationMenuItem>
 *     <NavigationMenuItem>
 *       <NavigationMenuLink href="/docs" active>Docs</NavigationMenuLink>
 *     </NavigationMenuItem>
 *   </NavigationMenuList>
 * </NavigationMenu>
 * ```
 *
 * The panel is **hover-opened and Escape-closable**, which is the whole point
 * of the pattern: a pointer can cross from the trigger to the panel without
 * the menu closing under it, and a keyboard user gets a real focusable panel
 * rather than a hover-only one.
 *
 * A trigger with no panel is just a link, which is why an item may hold
 * either one.
 */

interface NavigationContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  contentId: string;
  /** Close the panel and cancel any pending timers. */
  dismiss: () => void;
  /** Open on hover, after the menu's delay. */
  scheduleOpen: () => void;
}

const NavigationContext = createContext<NavigationContextValue>();

function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("NavigationMenu parts must be used inside a <NavigationMenu>.");
  return context;
}

export interface NavigationMenuProps {
  /**
   * Controlled open state. Omit to let hover and click own it.
   *
   * `open` rather than Radix's per-item `value`: this menu has one panel at a
   * time, and the boolean is what the rest of this library uses for the same
   * thing (`Popover`, `Tooltip`, `Select`).
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Milliseconds a hover must last before the panel opens. `200` by default. */
  delayDuration?: number;
  /** Milliseconds after the pointer leaves before it closes. `300` by default. */
  closeDelay?: number;
  children?: JSX.Element;
  class?: string;
  [key: string]: unknown;
}

export function NavigationMenu(props: NavigationMenuProps): JSX.Element {
  const [local, rest] = split(props, [
    "open",
    "defaultOpen",
    "onOpenChange",
    "delayDuration",
    "closeDelay",
    "children",
    "class",
  ]);

  const isControlled = () => local.open !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const open = (): boolean => (isControlled() ? (local.open ?? false) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  const [trigger, setTrigger] = createSignal<HTMLElement>();
  const id = createUniqueId();

  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const clearTimers = () => {
    if (openTimer !== undefined) clearTimeout(openTimer);
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    openTimer = undefined;
    closeTimer = undefined;
  };

  // A panel is content the user has not chosen to see, so it waits — but only
  // briefly, or moving across the bar feels broken.
  const scheduleOpen = () => {
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    closeTimer = undefined;
    if (openTimer !== undefined || open()) return;

    openTimer = setTimeout(() => {
      openTimer = undefined;
      setOpen(true);
    }, local.delayDuration ?? 200);
  };

  const scheduleClose = () => {
    if (openTimer !== undefined) clearTimeout(openTimer);
    openTimer = undefined;
    if (closeTimer !== undefined) return;

    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, local.closeDelay ?? 300);
  };

  const dismiss = () => {
    clearTimers();
    setOpen(false);
  };

  return (
    <NavigationContext
      value={{
        open,
        setOpen: (next) => {
          // Any explicit change cancels pending hover timers, so a click is
          // not undone a moment later by a delayed open.
          clearTimers();
          setOpen(next);
        },
        trigger,
        setTrigger,
        contentId: `navigation-${id}-content`,
        dismiss,
        scheduleOpen,
      }}
    >
      <nav
        data-slot="navigation-menu"
        data-open={open() ? "" : undefined}
        class={cn("group/navigation-menu relative flex max-w-max flex-1 items-center justify-center", local.class)}
        onPointerLeave={scheduleClose}
        onPointerEnter={() => {
          if (closeTimer !== undefined) clearTimeout(closeTimer);
          closeTimer = undefined;
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          dismiss();
          // Back to the trigger, so a keyboard user is not stranded at the
          // top of the document.
          trigger()?.focus();
        }}
        {...rest}
      >
        {local.children}
      </nav>
    </NavigationContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function NavigationMenuList(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <ul
      data-slot="navigation-menu-list"
      class={cn("group flex flex-1 list-none items-center justify-center gap-1", local.class)}
      {...rest}
    >
      {local.children}
    </ul>
  );
}

export function NavigationMenuItem(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <li data-slot="navigation-menu-item" class={cn("relative", local.class)} {...rest}>
      {local.children}
    </li>
  );
}

export interface NavigationMenuTriggerProps extends PartProps {
  /** The panel's id, when there is one — so `aria-controls` has something to
   *  point at. */
  controls?: string;
  disabled?: boolean;
}

export function NavigationMenuTrigger(props: NavigationMenuTriggerProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "controls", "disabled"]);
  const navigation = useNavigation();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "navigation-menu-trigger",
    "data-state": navigation.open() ? ("open" as const) : ("closed" as const),
    "aria-expanded": navigation.open() ? ("true" as const) : ("false" as const),
    "aria-controls": local.controls as string | undefined,
    disabled: local.disabled,
    class: cn(
      "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium",
      "transition-[color,background-color] outline-none hover:bg-accent hover:text-accent-foreground",
      "focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
      "data-[state=open]:bg-accent/50 data-[state=open]:text-accent-foreground",
      local.class,
    ),
    onClick: () => navigation.setOpen(!navigation.open()),
    onPointerEnter: () => navigation.scheduleOpen(),
    ref: (element: HTMLElement) => navigation.setTrigger(element),
  });

  return local.asChild ? (
    asChild(() => local.children ?? null, attributes)
  ) : (
    <button {...attributes()} {...rest}>
      {local.children}
    </button>
  );
}

export interface NavigationMenuContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function NavigationMenuContent(props: NavigationMenuContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "side", "sideOffset", "align"]);

  const navigation = useNavigation();
  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "center";

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(navigation.trigger, () => panel, navigation.open, {
    placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
    offset: local.sideOffset ?? 8,
  });

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="navigation-menu-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          id={navigation.contentId}
          style={floating.style()}
          class={cn(
            "z-50 w-max rounded-md border bg-popover p-2 text-popover-foreground shadow-md outline-hidden",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          // The pointer must be able to cross from the trigger into the panel
          // without the menu closing under it, so hovering keeps it open.
          onPointerEnter={() => navigation.setOpen(true)}
          onPointerLeave={() => navigation.setOpen(false)}
          {...rest}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
}

export interface NavigationMenuLinkProps extends PartProps {
  /** Marks this link as the current page. */
  active?: boolean;
}

export function NavigationMenuLink(props: NavigationMenuLinkProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "active"]);
  const navigation = useNavigation();

  const attributes = () => ({
    "data-slot": "navigation-menu-link",
    "data-active": local.active ? "" : undefined,
    "aria-current": local.active ? ("page" as const) : undefined,
    class: cn(
      "flex flex-col gap-1 rounded-sm p-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
      "focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
      local.active && "bg-accent/50 text-accent-foreground",
      local.class,
    ),
    // The panel is a flyout, not a page: choosing a link closes it.
    onClick: () => navigation.dismiss(),
  });

  return local.asChild ? (
    asChild(() => local.children ?? null, attributes)
  ) : (
    <a {...attributes()} {...rest}>
      {local.children}
    </a>
  );
}

export function NavigationMenuIndicator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);

  return (
    <div
      data-slot="navigation-menu-indicator"
      aria-hidden="true"
      class={cn(
        "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden",
        "before:size-2 before:rotate-45 before:bg-popover before:content-['']",
        local.class,
      )}
      {...rest}
    >
      <div class="relative top-[70%] size-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </div>
  );
}