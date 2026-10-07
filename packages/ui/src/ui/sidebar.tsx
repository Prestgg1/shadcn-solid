import type { JSX } from "@solidjs/web";
import { Show, createContext, createEffect, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * Sidebar — a collapsible app shell.
 *
 * ```tsx
 * <SidebarProvider>
 *   <Sidebar collapsible="icon">
 *     <SidebarHeader />
 *     <SidebarContent>
 *       <SidebarGroup>
 *         <SidebarGroupLabel>Projects</SidebarGroupLabel>
 *         <SidebarMenu>
 *           <SidebarMenuItem>
 *             <SidebarMenuButton asChild><a href="/">Overview</a></SidebarMenuButton>
 *           </SidebarMenuItem>
 *         </SidebarMenu>
 *       </SidebarGroup>
 *     </SidebarContent>
 *   </Sidebar>
 *   <SidebarInset>
 *     <SidebarTrigger />
 *     <main>…</main>
 *   </SidebarInset>
 * </SidebarProvider>
 * ```
 *
 * Three states, not two, and the middle one is the interesting one. A sidebar
 * can be **expanded** (labels and icons), **collapsed** to a rail (icons
 * only), or **hidden** entirely. Collapsing to icons is what an app actually
 * wants when the labels stop being worth the pixels — and it is where a
 * naive implementation becomes a wall of unlabelled icons, so the labels stay
 * in the DOM and are hidden with `sr-only` instead.
 *
 * `⌘B` / `Ctrl+B` toggles it. That shortcut is taken rather than invented
 * here, because it is the one users already try.
 */

export type SidebarState = "expanded" | "collapsed" | "hidden";

interface SidebarContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  state: () => SidebarState;
  setState: (state: SidebarState) => void;
}

const SidebarContext = createContext<SidebarContextValue>();

function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("Sidebar parts must be used inside a <SidebarProvider>.");
  return context;
}

/** Only the provider and `Sidebar` need this; everything else uses context. */
function useSidebarParts() {
  return useContext(SidebarContext);
}

export interface SidebarProviderProps {
  /** Controlled open state. Omit to let the trigger own it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function SidebarProvider(props: SidebarProviderProps): JSX.Element {
  const [local, rest] = split(props, ["open", "defaultOpen", "onOpenChange", "class", "children"]);

  const isControlled = () => local.open !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? true);
  const open = (): boolean => (isControlled() ? (local.open ?? true) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  // On `document`, not on the wrapper: the shortcut has to work wherever
  // focus happens to be, and a keypress with focus on `body` never reaches a
  // child element. The listener is torn down with the provider, and only
  // while there is a sidebar worth toggling.
  createEffect(
    () => typeof document !== "undefined",
    (inBrowser) => {
      if (!inBrowser) return;

      const onKeyDown = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key !== "b" && event.key !== "B") return;
        event.preventDefault();
        setOpen(!open());
      };

      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    },
  );

  return (
    <SidebarContext
      value={{
        open,
        setOpen,
        toggle: () => setOpen(!open()),
        // The provider only knows about open and closed; the rail is the
        // sidebar's own decision, and it round-trips through here.
        state: () => (open() ? "expanded" : "collapsed"),
        setState: (state) => setOpen(state === "expanded"),
      }}
    >
      <div
        data-slot="sidebar-wrapper"
        data-state={open() ? "expanded" : "collapsed"}
        class={cn(
          "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </div>
    </SidebarContext>
  );
}

export interface SidebarProps {
  /** `"icon"` allows collapsing to a rail; `"none"` hides it entirely. */
  collapsible?: "offcanvas" | "icon" | "none";
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const [local, rest] = split(props, ["collapsible", "class", "children"]);
  const sidebar = useSidebarParts();

  const state = () => sidebar?.state() ?? "expanded";

  return (
    <div
      data-slot="sidebar"
      data-state={state()}
      data-collapsible={local.collapsible ?? "icon"}
      // A complementary landmark with a name, so a screen reader's landmark
      // list offers it as "Sidebar" rather than an unnamed region.
      role="complementary"
      aria-label="Sidebar"
      id="sidebar"
      class={cn(
        "flex h-full w-(--sidebar-width) flex-col border-r bg-sidebar text-sidebar-foreground",
        // The rail: narrow, and still holding the labels for assistive tech.
        "data-[state=collapsed]:w-(--sidebar-width-icon)",
        local.class,
      )}
      {...rest}
    >
      <Show when={state() === "collapsed" && local.collapsible !== "icon"}>
        <span class="sr-only">The sidebar is collapsed.</span>
      </Show>
      {local.children}
    </div>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function SidebarHeader(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-header"
      class={cn("flex flex-col gap-2 p-2", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SidebarContent(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-content"
      class={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SidebarFooter(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="sidebar-footer" class={cn("flex flex-col gap-2 p-2", local.class)} {...rest}>
      {local.children}
    </div>
  );
}

/**
 * The id a group's label will carry, so the two can find each other without
 * the caller passing an `id` around.
 */
const GroupLabelIdContext = createContext<string>();

export function SidebarGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const labelId = createUniqueId();

  return (
    <GroupLabelIdContext value={labelId}>
      <div
        data-slot="sidebar-group"
        // Named by the label rendered inside it, so a screen reader's heading
        // list and this group agree.
        role="group"
        aria-labelledby={labelId}
        class={cn("relative flex w-full min-w-0 flex-col p-2", local.class)}
        {...rest}
      >
        {local.children}
      </div>
    </GroupLabelIdContext>
  );
}

export function SidebarGroupLabel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const labelId = useContext(GroupLabelIdContext);

  return (
    <div
      data-slot="sidebar-group-label"
      id={labelId}
      class={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70",
        // Hidden visually when collapsed, still there for a screen reader.
        "group-data-[state=collapsed]/sidebar-wrapper:sr-only",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SidebarGroupAction(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-group-action"
      class={cn("absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SidebarMenu(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <ul
      data-slot="sidebar-menu"
      class={cn("flex w-full min-w-0 flex-col gap-1", local.class)}
      {...rest}
    >
      {local.children}
    </ul>
  );
}

export function SidebarMenuItem(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <li data-slot="sidebar-menu-item" class={cn("group/menu-item relative", local.class)} {...rest}>
      {local.children}
    </li>
  );
}

export interface SidebarMenuButtonProps extends PartProps {
  /** Marks this as the current page. */
  isActive?: boolean;
  disabled?: boolean;
  size?: "default" | "sm" | "lg";
  /**
   * The item's name, for the icon-only rail.
   *
   * Children stay visible in both states — that is what lets an app choose
   * per item. This is the fallback for when a caller has swapped the label
   * for an icon, and it is what stops a collapsed sidebar from being a column
   * of unlabelled glyphs.
   */
  label?: string;
}

export function SidebarMenuButton(props: SidebarMenuButtonProps): JSX.Element {
  const [local, rest] = split(props, [
    "class",
    "children",
    "asChild",
    "isActive",
    "disabled",
    "size",
    "label",
  ]);

  return (
    <button
      type="button"
      data-slot="sidebar-menu-button"
      data-size={local.size ?? "default"}
      data-active={local.isActive ? "" : undefined}
      data-sidebar="menu-button"
      disabled={local.disabled}
      class={cn(
        "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden",
        "transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
        "data-[active]:bg-sidebar-accent data-[active]:font-medium",
        "disabled:pointer-events-none disabled:opacity-50",
        "peer/menu-button:rounded-lg",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <Show when={local.label}>
        <span data-slot="sidebar-menu-label" class="sr-only">
          {local.label}
        </span>
      </Show>
    </button>
  );
}

export function SidebarMenuBadge(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-menu-badge"
      class={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs tabular-nums select-none",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SidebarMenuSkeleton(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      class={cn("flex h-8 items-center gap-2 rounded-md px-2", local.class)}
      {...rest}
    >
      <div class="size-4 animate-pulse rounded-md bg-sidebar-accent" />
      <div class="h-4 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-accent" />
    </div>
  );
}

export function SidebarMenuSub(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <ul
      data-slot="sidebar-menu-sub"
      class={cn("mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5", local.class)}
      {...rest}
    >
      {local.children}
    </ul>
  );
}

export function SidebarMenuSubItem(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <li data-slot="sidebar-menu-sub-item" class={cn("group/menu-sub-item relative", local.class)} {...rest}>
      {local.children}
    </li>
  );
}

export function SidebarMenuSubButton(props: SidebarMenuButtonProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "isActive", "size"]);

  return (
    <button
      type="button"
      data-slot="sidebar-menu-sub-button"
      data-size={local.size ?? "default"}
      data-active={local.isActive ? "" : undefined}
      data-sidebar="menu-sub-button"
      class={cn(
        "flex h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm outline-hidden",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        "data-[active]:bg-sidebar-accent",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </button>
  );
}

export function SidebarInset(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <main
      data-slot="sidebar-inset"
      class={cn("relative flex min-h-svh flex-1 flex-col bg-background", local.class)}
      {...rest}
    >
      {local.children}
    </main>
  );
}

export function SidebarTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const sidebar = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-trigger"
      data-sidebar="trigger"
      aria-controls="sidebar"
      aria-expanded={sidebar.open() ? "true" : "false"}
      class={cn(
        "inline-flex size-7 items-center justify-center rounded-md border bg-background transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        local.class,
      )}
      onClick={sidebar.toggle}
      {...rest}
    >
      {local.children ?? <PanelIcon />}
      <span class="sr-only">Toggle sidebar</span>
    </button>
  );
}

function PanelIcon(): JSX.Element {
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
      class="size-4"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

export function SidebarRail(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const sidebar = useSidebar();

  return (
    <button
      type="button"
      data-slot="sidebar-rail"
      aria-label="Toggle sidebar"
      // A 1px hit target you are meant to hit with a stray mouse movement.
      class={cn(
        "absolute inset-y-0 z-20 hidden w-2 -translate-x-1/2 transition-all sm:flex",
        "group-data-[state=expanded]/sidebar-wrapper:left-[calc(var(--sidebar-width))]",
        "group-data-[state=collapsed]/sidebar-wrapper:left-0",
        local.class,
      )}
      onClick={sidebar.toggle}
      {...rest}
    />
  );
}

/** Shown instead of the content when a route is still loading. */
export function SidebarLoader(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div
      data-slot="sidebar-loader"
      role="status"
      aria-live="polite"
      class={cn("flex items-center gap-2 p-2 text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children ?? "Loading…"}
    </div>
  );
}