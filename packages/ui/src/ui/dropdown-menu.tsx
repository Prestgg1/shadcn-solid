import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { dismissable } from "~/lib/dismissable";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";
import { rovingFocus } from "~/lib/roving-focus";
import { asChild } from "~/lib/slot";

/**
 * DropdownMenu — a menu of actions anchored to a button.
 *
 * ```tsx
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild><Button variant="outline">Options</Button></DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuLabel>Account</DropdownMenuLabel>
 *     <DropdownMenuItem onSelect={toProfile}>Profile</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuCheckboxItem checked={showStatus()}>Show status</DropdownMenuCheckboxItem>
 *     <DropdownMenuItem variant="destructive">Delete…</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 * ```
 *
 * Follows the WAI-ARIA menu-button pattern. The differences from a listbox
 * are deliberate: the trigger is a real `menu` button, the panel is
 * `role="menu"`, and items are `menuitem`s reached by arrows rather than
 * tabbing — a menu that takes eleven presses to cross is not a menu.
 *
 * `Escape` closes and returns focus to the trigger, which is what makes a
 * menu safe to open by accident.
 */

interface MenuContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  /** Depth of the submenu that owns this context; 0 at the root. */
  depth: number;
  /** Close this menu and hand focus back to its trigger. */
  close: () => void;
  closeAll: () => void;
}

const MenuContext = createContext<MenuContextValue>();

function useMenu(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error("DropdownMenu parts must be used inside a <DropdownMenu>.");
  return context;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function DropdownMenu(props: DropdownMenuProps): JSX.Element {
  const [local] = split(props, ["open", "defaultOpen", "onOpenChange", "children"]);

  const isControlled = () => local.open !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const open = (): boolean => (isControlled() ? (local.open ?? false) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  const [trigger, setTrigger] = createSignal<HTMLElement>();

  // Focus goes back to the trigger on every close, not just on Escape. A menu
  // that vanishes with focus inside it drops the user at the top of the page.
  const close = () => {
    setOpen(false);
    trigger()?.focus();
  };

  return (
    <MenuContext
      value={{
        open,
        setOpen,
        trigger,
        setTrigger,
        depth: 0,
        close,
        closeAll: () => setOpen(false),
      }}
    >
      {local.children}
    </MenuContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function DropdownMenuTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const menu = useMenu();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "dropdown-menu-trigger",
    "data-state": menu.open() ? ("open" as const) : ("closed" as const),
    "aria-haspopup": "menu" as const,
    "aria-expanded": menu.open() ? ("true" as const) : ("false" as const),
    class: cn(local.class),
    onClick: () => menu.setOpen(!menu.open()),
    ref: (element: HTMLElement) => menu.setTrigger(element),
  });

  return local.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <button {...attributes()} {...rest}>
          {local.children}
        </button>
      );
}

export interface DropdownMenuContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function DropdownMenuContent(props: DropdownMenuContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "side", "sideOffset", "align"]);

  const menu = useMenu();
  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "start";

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(
    () => menu.trigger(),
    () => panel,
    menu.open,
    {
      placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
      offset: local.sideOffset ?? 4,
      sameWidth: true,
    },
  );

  // `dismissable` handles Escape in the capture phase, before the panel's own
  // key handler can see it — so the focus restoration has to live here.
  dismissable(menu.open, menu.close, {
    inside: () => panel,
    outside: () => menu.trigger(),
  });

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="dropdown-menu-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          role="menu"
          style={floating.style()}
          class={cn(
            "z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          {...rest}
        >
          <MenuItems>{local.children}</MenuItems>
        </div>
      </Portal>
    </Show>
  );
}

/**
 * The roving-focus container for a panel's items.
 *
 * One tab stop per menu, arrows between items — separate from the panel so the
 * listeners attach to an element that exists for as long as the items do.
 */
function MenuItems(props: { children?: JSX.Element }): JSX.Element {
  const [list, setList] = createSignal<HTMLDivElement>();

  rovingFocus(list, {
    orientation: "vertical",
    loop: false,
    // A menu item is activated on click or Enter, not by landing on it, so
    // arrowing past "Delete" must not delete anything.
    selectOnFocus: false,
  });

  return (
    <div ref={setList} data-slot="dropdown-menu-items" class="contents">
      {props.children}
    </div>
  );
}

function MenuItemIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="size-4 shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

interface ItemProps extends PartProps {
  variant?: "default" | "destructive";
  disabled?: boolean;
  /** `onSelect` rather than `onClick`, matching the ARIA role's vocabulary. */
  onSelect?: () => void;
  /** Render a checkbox. `checked` drives it. */
  checked?: boolean;
}

export function DropdownMenuItem(props: ItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "variant", "disabled", "onSelect"]);
  const menu = useMenu();

  return (
    <div
      data-slot="dropdown-menu-item"
      data-variant={local.variant ?? "default"}
      data-disabled={local.disabled ? "" : undefined}
      data-roving-item
      role="menuitem"
      tabindex={-1}
      aria-disabled={local.disabled ? "true" : undefined}
      class={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground data-[roving-item][tabindex='0']:bg-accent data-[roving-item][tabindex='0']:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        local.variant === "destructive" && "text-destructive focus:bg-destructive/10 focus:text-destructive data-[roving-item][tabindex='0']:bg-destructive/10",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        local.onSelect?.();
        menu.close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        (event.currentTarget as HTMLElement).click();
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
}

/** A menu item with a checkbox. Keeps the menu open — the value is toggled. */
export function DropdownMenuCheckboxItem(props: ItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled", "onSelect", "checked"]);

  return (
    <div
      data-slot="dropdown-menu-checkbox-item"
      data-disabled={local.disabled ? "" : undefined}
      data-state={local.checked ? "checked" : "unchecked"}
      data-roving-item
      role="menuitemcheckbox"
      aria-checked={local.checked ? "true" : "false"}
      aria-disabled={local.disabled ? "true" : undefined}
      tabindex={-1}
      class={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground data-[roving-item][tabindex='0']:bg-accent data-[roving-item][tabindex='0']:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        local.onSelect?.();
        // Deliberately does not close: a checkbox that closes the menu on
        // every tick cannot be ticked twice in a row.
      }}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Show when={local.checked}>
          <MenuItemIcon />
        </Show>
      </span>
      {local.children}
    </div>
  );
}

/** A menu item with a radio dot. Closes the menu, like any other choice. */
export function DropdownMenuRadioItem(props: ItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled", "onSelect", "checked"]);
  const menu = useMenu();

  return (
    <div
      data-slot="dropdown-menu-radio-item"
      data-disabled={local.disabled ? "" : undefined}
      data-state={local.checked ? "checked" : "unchecked"}
      data-roving-item
      role="menuitemradio"
      aria-checked={local.checked ? "true" : "false"}
      tabindex={-1}
      class={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground data-[roving-item][tabindex='0']:bg-accent",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        local.onSelect?.();
        menu.close();
      }}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Show when={local.checked}>
          <span class="size-2 rounded-full bg-current" />
        </Show>
      </span>
      {local.children}
    </div>
  );
}

export function DropdownMenuGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="dropdown-menu-group" role="group" class={cn("py-0.5", local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export function DropdownMenuLabel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="dropdown-menu-label"
      class={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function DropdownMenuSeparator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div data-slot="dropdown-menu-separator" role="separator" class={cn("-mx-1 my-1 h-px bg-border", local.class)} {...rest} />
  );
}

export function DropdownMenuShortcut(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      class={cn("ml-auto text-xs tracking-widest text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </span>
  );
}

export interface DropdownMenuSubProps {
  children?: JSX.Element;
}

/**
 * A menu that opens sideways from its item.
 *
 * Every level gets its own context, so closing the submenu closes only the
 * submenu — and `closeAll` walks the chain. The panel is positioned against
 * its *item* rather than the root trigger, which is what makes it fly out from
 * the right edge of the row it belongs to.
 */
export function DropdownMenuSub(props: DropdownMenuSubProps): JSX.Element {
  const [local] = split(props, ["children"]);
  const parent = useMenu();
  const [open, setOpen] = createSignal(false);
  const [trigger, setTrigger] = createSignal<HTMLElement>();

  const close = () => {
    setOpen(false);
    trigger()?.focus();
  };

  const closeAll = () => {
    setOpen(false);
    parent.closeAll();
  };

  return (
    <MenuContext
      value={{
        open,
        setOpen,
        trigger,
        setTrigger,
        depth: parent.depth + 1,
        close,
        closeAll,
      }}
    >
      {local.children}
    </MenuContext>
  );
}

interface SubProps extends PartProps {
  children?: JSX.Element;
}

export function DropdownMenuSubTrigger(props: SubProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const menu = useMenu();

  return (
    <div
      ref={(element: HTMLElement) => menu.setTrigger(element)}
      data-slot="dropdown-menu-sub-trigger"
      data-state={menu.open() ? "open" : "closed"}
      data-roving-item
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={menu.open() ? "true" : "false"}
      tabindex={-1}
      class={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
        "data-[roving-item][tabindex='0']:bg-accent data-[state=open]:bg-accent",
        local.class,
      )}
      onPointerEnter={() => menu.setOpen(true)}
      onClick={() => menu.setOpen(!menu.open())}
      {...rest}
    >
      {local.children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="ml-auto size-4"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

export function DropdownMenuSubContent(props: DropdownMenuSubProps): JSX.Element {
  const [local] = split(props, ["children"]);
  const menu = useMenu();

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(
    () => menu.trigger(),
    () => panel,
    menu.open,
    { placement: "right-start", offset: 4, flip: false, shift: true },
  );

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="dropdown-menu-sub-content"
          data-state={floating.presence.state()}
          role="menu"
          style={floating.style()}
          class="z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter"
          // Pointer has to be able to cross the gap between the item and the
          // panel without the menu closing under it.
          onPointerEnter={() => menu.setOpen(true)}
        >
          <MenuItems>{local.children}</MenuItems>
        </div>
      </Portal>
    </Show>
  );
}

/** Groups radio items so a screen reader announces them as one question. */
export function DropdownMenuRadioGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="dropdown-menu-radio-group" role="group" class={cn(local.class)} {...rest}>
      {local.children}
    </div>
  );
}
