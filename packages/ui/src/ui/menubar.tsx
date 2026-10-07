import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";
import { asChild } from "~/lib/slot";

/**
 * Menubar — an application menu bar, the kind that sits at the top of a
 * desktop window.
 *
 * ```tsx
 * <Menubar>
 *   <MenubarMenu>
 *     <MenubarTrigger>File</MenubarTrigger>
 *     <MenubarContent>
 *       <MenubarItem onSelect={open}>Open</MenubarItem>
 *       <MenubarSeparator />
 *       <MenubarShortcut>⌘S</MenubarShortcut>
 *     </MenubarContent>
 *   </MenubarMenu>
 * </Menubar>
 * ```
 *
 * Two behaviours separate this from `DropdownMenu`:
 *
 * **Only one menu is open at a time**, across the whole bar. That is what a
 * menu bar is — File and Edit are alternatives, not layers.
 *
 * **The bar itself keeps the selection.** Arrow keys move *between* menus when
 * nothing is open, and open the next one as they arrive — the behaviour every
 * desktop menu bar has and that a row of independent dropdowns cannot have.
 */

interface MenubarContextValue {
  /** The value of the open menu, if any. */
  open: () => string | undefined;
  setOpen: (value: string | undefined) => void;
  toggle: (value: string) => void;
  /** Move the selection by `delta` menus. */
  move: (delta: number) => void;
  values: () => string[];
  /** Record a menu so the bar can move between them. */
  register: (value: string) => void;
  closeAll: () => void;
}

const MenubarContext = createContext<MenubarContextValue>();

function useMenubar(): MenubarContextValue {
  const context = useContext(MenubarContext);
  if (!context) throw new Error("Menubar parts must be used inside a <Menubar>.");
  return context;
}

export interface MenubarProps {
  /** Controlled open menu value. Omit for an uncontrolled bar. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  /** Controlled selection, for the arrows-when-closed behaviour. */
  active?: string;
  onActiveChange?: (value: string) => void;
  class?: string;
  children?: JSX.Element;
  loop?: boolean;
  [key: string]: unknown;
}

export function Menubar(props: MenubarProps): JSX.Element {
  const [local, rest] = split(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "active",
    "onActiveChange",
    "class",
    "children",
    "loop",
  ]);

  const openControlled = () => local.value !== undefined;
  const [openUncontrolled, setOpenUncontrolled] = createSignal<string | undefined>(local.defaultValue);
  const open = (): string | undefined => (openControlled() ? local.value : openUncontrolled());

  const setOpen = (next: string | undefined) => {
    if (!openControlled()) setOpenUncontrolled(next);
    local.onValueChange?.(next);
  };

  const [activeUncontrolled, setActiveUncontrolled] = createSignal<string>();
  const active = (): string | undefined => (local.active !== undefined ? local.active : activeUncontrolled());

  const setActive = (next: string) => {
    if (local.active === undefined) setActiveUncontrolled(next);
    local.onActiveChange?.(next);
  };

  // Registered by each `MenubarMenu` as it mounts, so the bar can move between
  // menus without being told how many there are.
  const [values, setValues] = createSignal<string[]>([]);

  const move = (delta: number) => {
    const list = values();
    if (list.length === 0) return;

    const at = list.indexOf(active() ?? "");

    // With nothing selected the first press lands on an end: right on the
    // first menu, left on the last — the same two the user is reaching for.
    const next =
      at === -1
        ? (delta > 0 ? list[0] : list[list.length - 1])!
        : list[(at + delta + list.length) % list.length]!;

    setActive(next);

    // Arrows arrive at a menu and open it, whether or not one was already
    // open — on a menu bar the arrow keys are the way you move between them.
    // Once a menu is open, `MenubarContent` claims the arrows instead and
    // they walk its items.
    setOpen(next);
  };

  return (
    <MenubarContext
      value={{
        open,
        setOpen,
        toggle: (value) => setOpen(open() === value ? undefined : value),
        move,
        values,
        register: (value) => {
          if (values().includes(value)) return;
          setValues((previous) => [...previous, value]);
        },
        closeAll: () => setOpen(undefined),
      }}
    >
      <div
        data-slot="menubar"
        role="menubar"
        data-slot-orientation="horizontal"
        class={cn(
          "flex h-9 items-center gap-1 rounded-md border bg-background p-1 shadow-xs",
          local.class,
        )}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "Escape") {
            setOpen(undefined);
          }
        }}
        {...rest}
      >
        {local.children}
      </div>
    </MenubarContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

/** One menu's own state: which menu it is, and the trigger it hangs from. */
interface MenuValue {
  id: string;
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
}

const MenuValueContext = createContext<MenuValue>();

function useMenu(): MenuValue {
  const menu = useContext(MenuValueContext);
  if (!menu) throw new Error("MenubarTrigger and MenubarContent need a <MenubarMenu> around them.");
  return menu;
}

export interface MenubarMenuProps extends PartProps {
  /** Identifies this menu within the bar. Generated when omitted. */
  value?: string;
}

export function MenubarMenu(props: MenubarMenuProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "value"]);
  const menubar = useMenubar();

  // Registered during the body, so the bar knows its menus from the first
  // render rather than after an effect has run.
  const id = local.value ?? createUniqueId();
  menubar.register(id);

  const [trigger, setTrigger] = createSignal<HTMLElement>();

  // The trigger and its panel share this, which is what lets the panel find
  // the trigger it belongs to without either being told about the other.
  const menu: MenuValue = {
    id,
    open: () => menubar.open() === id,
    setOpen: (next) => menubar.setOpen(next ? id : undefined),
    trigger,
    setTrigger,
  };

  return (
    <MenuValueContext value={menu}>
      <div data-slot="menubar-menu" data-value={id} class={cn("relative", local.class)} {...rest}>
        {local.children}
      </div>
    </MenuValueContext>
  );
}

export function MenubarTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const menu = useMenu();
  // Read at setup, not inside the handler: `useContext` resolves through the
  // owner, which an event callback no longer has.
  const menubar = useMenubar();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "menubar-trigger",
    "data-state": menu.open() ? ("open" as const) : ("closed" as const),
    "aria-haspopup": "menu" as const,
    "aria-expanded": menu.open() ? ("true" as const) : ("false" as const),
    class: cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden",
      "focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      local.class,
    ),
    ref: (element: HTMLElement) => menu.setTrigger(element),
    onClick: () => menu.setOpen(!menu.open()),
    // Hovering a bar item opens its menu, but only once one is already open —
    // otherwise sweeping the pointer across the bar would flash every menu.
    onPointerEnter: () => {
      if (menubar.open() !== undefined) menu.setOpen(true);
    },
  });

  return local.asChild ? (
    asChild(() => local.children ?? null, attributes)
  ) : (
    <button {...attributes()} {...rest}>
      {local.children}
    </button>
  );
}

interface ContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function MenubarContent(props: ContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "side", "sideOffset", "align"]);

  const menubar = useMenubar();
  const menu = useMenu();
  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "start";

  let panel: HTMLElement | undefined;

  // The panel hangs off its own menu's trigger, not the bar.
  const floating = floatingPanel(menu.trigger, () => panel, menu.open, {
    placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
    offset: local.sideOffset ?? 4,
    sameWidth: true,
  });

  const activeItem = () => panel?.querySelector<HTMLElement>('[data-roving-item][tabindex="0"]');

  const step = (delta: number) => {
    const items = Array.from(panel?.querySelectorAll<HTMLElement>("[data-roving-item]") ?? []);
    if (items.length === 0) return;

    const at = items.findIndex((element) => element === activeItem());
    const from = at === -1 ? (delta > 0 ? -1 : 0) : at;
    const next = items[(from + delta + items.length) % items.length]!;

    for (const item of items) item.setAttribute("tabindex", item === next ? "0" : "-1");
    next.focus();
  };

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => (panel = element)}
          data-slot="menubar-content"
          data-state={floating.presence.state()}
          role="menu"
          style={floating.style()}
          class={cn(
            "z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              step(1);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              step(-1);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              menubar.setOpen(undefined);
              // Back on the bar, which is where a menu bar puts you.
              menu.trigger()?.focus();
            }
          }}
          {...rest}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
}

interface ItemProps extends PartProps {
  disabled?: boolean;
  variant?: "default" | "destructive";
  onSelect?: () => void;
  /** `onSelect` rather than `onClick`, matching the ARIA role's vocabulary. */
  inset?: boolean;
}

export function MenubarItem(props: ItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled", "variant", "onSelect", "inset"]);
  const menubar = useMenubar();

  return (
    <div
      data-slot="menubar-item"
      data-roving-item
      data-disabled={local.disabled ? "" : undefined}
      data-variant={local.variant ?? "default"}
      role="menuitem"
      tabindex={-1}
      aria-disabled={local.disabled ? "true" : undefined}
      class={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        local.inset && "pl-8",
        local.variant === "destructive" && "text-destructive focus:bg-destructive/10 focus:text-destructive",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        local.onSelect?.();
        menubar.closeAll();
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

export interface MenubarCheckboxItemProps extends ItemProps {
  checked?: boolean;
}

export function MenubarCheckboxItem(props: MenubarCheckboxItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled", "checked", "onSelect", "inset"]);

  return (
    <div
      data-slot="menubar-checkbox-item"
      data-roving-item
      data-state={local.checked ? "checked" : "unchecked"}
      role="menuitemcheckbox"
      aria-checked={local.checked ? "true" : "false"}
      tabindex={-1}
      class={cn(
        "relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        local.onSelect?.();
        // Stays open: a checkbox that closes the bar on every tick cannot be
        // ticked twice in a row.
      }}
      {...rest}
    >
      <span class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Show when={local.checked}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </Show>
      </span>
      {local.children}
    </div>
  );
}

export function MenubarRadioGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="menubar-radio-group" role="group" class={cn(local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export function MenubarRadioItem(props: MenubarCheckboxItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled", "checked", "onSelect", "inset"]);
  const menubar = useMenubar();

  return (
    <div
      data-slot="menubar-radio-item"
      data-roving-item
      role="menuitemradio"
      aria-checked={local.checked ? "true" : "false"}
      tabindex={-1}
      class={cn(
        "relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        local.onSelect?.();
        menubar.closeAll();
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

export function MenubarGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="menubar-group" role="group" class={cn(local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export function MenubarLabel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="menubar-label" class={cn("px-2 py-1.5 text-sm font-medium", local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export function MenubarSeparator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div data-slot="menubar-separator" role="separator" class={cn("-mx-1 my-1 h-px bg-border", local.class)} {...rest} />
  );
}

export function MenubarShortcut(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <span
      data-slot="menubar-shortcut"
      class={cn("ml-auto text-xs tracking-widest text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </span>
  );
}

export interface MenubarSubProps {
  children?: JSX.Element;
}

export interface MenubarSubTriggerProps extends PartProps {
  inset?: boolean;
}

export function MenubarSub(props: MenubarSubProps): JSX.Element {
  const [local] = split(props, ["children"]);
  const menubar = useMenubar();

  const [open, setOpen] = createSignal(false);
  const [trigger, setTrigger] = createSignal<HTMLElement>();

  return (
    <MenubarSubContext value={{ open, setOpen, trigger, setTrigger, closeAll: menubar.closeAll }}>
      {local.children}
    </MenubarSubContext>
  );
}

interface SubContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  closeAll: () => void;
}

const MenubarSubContext = createContext<SubContextValue>();

function useMenubarSub(): SubContextValue {
  const context = useContext(MenubarSubContext);
  if (!context) throw new Error("MenubarSub parts must be used inside a <MenubarSub>.");
  return context;
}

export function MenubarSubTrigger(props: MenubarSubTriggerProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "inset"]);
  const sub = useMenubarSub();

  return (
    <div
      ref={(element: HTMLElement) => sub.setTrigger(element)}
      data-slot="menubar-sub-trigger"
      data-roving-item
      data-state={sub.open() ? "open" : "closed"}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={sub.open() ? "true" : "false"}
      tabindex={-1}
      class={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
        "focus:bg-accent data-[state=open]:bg-accent",
        local.inset && "pl-8",
        local.class,
      )}
      onPointerEnter={() => sub.setOpen(true)}
      {...rest}
    >
      {local.children}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ml-auto size-4" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
  );
}

export interface MenubarSubContentProps extends PartProps {
  sideOffset?: number;
  alignOffset?: number;
}

export function MenubarSubContent(props: MenubarSubContentProps): JSX.Element {
  const [local] = split(props, ["class", "children", "sideOffset", "alignOffset"]);
  const sub = useMenubarSub();

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(sub.trigger, () => panel, sub.open, {
    placement: "right-start",
    offset: local.sideOffset ?? 4,
    flip: false,
    shift: true,
  });

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="menubar-sub-content"
          data-state={floating.presence.state()}
          role="menu"
          style={floating.style()}
          class="z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter"
          onPointerEnter={() => sub.setOpen(true)}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
}