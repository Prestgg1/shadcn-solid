import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { dismissable } from "~/lib/dismissable";
import { focusTrap } from "~/lib/focus-trap";
import { Portal } from "~/lib/portal";
import { createPresence } from "~/lib/presence";
import { scrollLock } from "~/lib/scroll-lock";
import { split } from "~/lib/split";

/**
 * Drawer — a panel that springs up from the bottom edge.
 *
 * ```tsx
 * <Drawer open={open()} onOpenChange={setOpen}>
 *   <DrawerTrigger asChild><Button>Open menu</Button></DrawerTrigger>
 *   <DrawerContent>
 *     <DrawerHeader><DrawerTitle>Menu</DrawerTitle></DrawerHeader>
 *     …
 *   </DrawerContent>
 * </Drawer>
 * ```
 *
 * The same modal machinery as `DialogContent`, with a different frame and
 * a taller default panel — it is built for phone menus and detail panes, not
 * for confirmations. On wide screens it anchors to the bottom rather than
 * growing to fill the screen, which is what keeps it from reading as a
 * full-screen takeover.
 */

interface DrawerContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
}

const DrawerContext = createContext<DrawerContextValue>();

function useDrawer(): DrawerContextValue {
  return useContext(DrawerContext);
}

export interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function Drawer(props: DrawerProps): JSX.Element {
  const [local] = split(props, ["open", "defaultOpen", "onOpenChange", "children"]);

  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const isControlled = () => local.open !== undefined;
  const open = (): boolean => (isControlled() ? (local.open ?? false) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  const id = createUniqueId();

  return (
    <DrawerContext
      value={{
        open,
        setOpen,
        contentId: `drawer-${id}-content`,
        titleId: `drawer-${id}-title`,
        descriptionId: `drawer-${id}-description`,
      }}
    >
      {local.children}
    </DrawerContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function DrawerTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDrawer();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "drawer-trigger",
    "data-state": context.open() ? ("open" as const) : ("closed" as const),
    "aria-expanded": context.open() ? ("true" as const) : ("false" as const),
    "aria-haspopup": "dialog" as const,
    class: cn(local.class),
    onClick: () => context.setOpen(true),
  });

  return local.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <button {...attributes()} {...rest}>
          {local.children}
        </button>
      );
}

export function DrawerClose(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDrawer();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "drawer-close",
    class: cn(local.class),
    onClick: () => context.setOpen(false),
  });

  return local.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <button {...attributes()} {...rest}>
          {local.children}
        </button>
      );
}

export function DrawerOverlay(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDrawer();
  const presence = createPresence(context.open);

  return (
    <Show when={presence.mounted()}>
      <div
        ref={presence.contentRef}
        data-slot="drawer-overlay"
        data-state={presence.state()}
        class={cn(
          "fixed inset-0 z-50 bg-black/55",
          "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
          local.class,
        )}
        {...rest}
      />
    </Show>
  );
}

export interface DrawerContentProps extends PartProps {
  /** Which edge to come from. Only `"bottom"` and `"top"` make sense here. */
  side?: "top" | "bottom";
}

export function DrawerContent(props: DrawerContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "side"]);
  const context = useDrawer();
  const presence = createPresence(context.open);

  const side = () => local.side ?? "bottom";

  // A signal because the panel is created by the `<Show>` below, after this
  // body has run — a plain variable would leave the trap with no container.
  const [panel, setPanel] = createSignal<HTMLElement>();

  scrollLock(document.body, () => presence.mounted());

  focusTrap(panel, () => presence.mounted(), { focusContainer: true });

  dismissable(
    () => presence.mounted(),
    () => context.setOpen(false),
    { inside: panel },
  );

  return (
    <Show when={presence.mounted()}>
      <Portal>
        <DrawerOverlay />
        <div
          ref={setPanel}
          data-slot="drawer-content"
          data-side={side()}
          data-state={presence.state()}
          id={context.contentId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={context.titleId}
          aria-describedby={context.descriptionId}
          tabindex={-1}
          class={cn(
            "fixed z-50 mt-24 flex max-h-[85vh] w-full flex-col gap-4 bg-background p-6",
            // `inset-x-0` plus a rounded top and a border only, so the panel
            // reads as attached to the edge rather than floating.
            side() === "top"
              ? "inset-x-0 top-0 rounded-b-lg border-b data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter"
              : "inset-x-0 bottom-0 rounded-t-lg border-t data-[state=closed]:animate-drawer-leave data-[state=open]:animate-drawer-enter",
            local.class,
          )}
          {...rest}
        >
          {/* The grip is decorative — the whole panel is draggable in a real
              implementation, and this says so without pretending to work. */}
          <div
            data-slot="drawer-handle"
            aria-hidden="true"
            class="mx-auto h-2 w-12 shrink-0 rounded-full bg-muted"
          />
          {local.children}
        </div>
      </Portal>
    </Show>
  );
}

export function DrawerHeader(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="drawer-header"
      class={cn("flex flex-col gap-2 text-center sm:text-left", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function DrawerFooter(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="drawer-footer"
      class={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function DrawerTitle(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <h2
      id={useDrawer().titleId}
      data-slot="drawer-title"
      class={cn("font-semibold", local.class)}
      {...rest}
    >
      {local.children}
    </h2>
  );
}

export function DrawerDescription(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <p
      id={useDrawer().descriptionId}
      data-slot="drawer-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
}