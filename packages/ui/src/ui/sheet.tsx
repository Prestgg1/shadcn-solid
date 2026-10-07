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
 * Sheet — a dialog that slides in from an edge.
 *
 * ```tsx
 * <Sheet open={open()} onOpenChange={setOpen}>
 *   <SheetTrigger asChild><Button>Open</Button></SheetTrigger>
 *   <SheetContent side="right">
 *     <SheetHeader>
 *       <SheetTitle>Settings</SheetTitle>
 *       <SheetDescription>Account and billing.</SheetDescription>
 *     </SheetHeader>
 *     …
 *   </SheetContent>
 * </Sheet>
 * ```
 *
 * `side` decides both the edge the panel comes from and which of the four
 * slide frames it animates with. Everything else — the scrim, the focus
 * trap, the scroll lock, dismissal — is the same as `DialogContent`, and is
 * wired here rather than asked of the caller.
 */

export type SheetSide = "top" | "right" | "bottom" | "left";

interface SheetContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
}

const SheetContext = createContext<SheetContextValue>();

function useSheet(): SheetContextValue {
  return useContext(SheetContext);
}

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function Sheet(props: SheetProps): JSX.Element {
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
    <SheetContext
      value={{
        open,
        setOpen,
        contentId: `sheet-${id}-content`,
        titleId: `sheet-${id}-title`,
        descriptionId: `sheet-${id}-description`,
      }}
    >
      {local.children}
    </SheetContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

/** The edge a sheet slides in from. Also picks the animation direction. */
function sideClasses(side: SheetSide): string {
  switch (side) {
    case "top":
      return "inset-x-0 top-0 h-auto border-b data-[state=closed]:animate-slide-leave-top data-[state=open]:animate-slide-enter-top";
    case "bottom":
      return "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:animate-slide-leave-bottom data-[state=open]:animate-slide-enter-bottom";
    case "left":
      return "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-[state=closed]:animate-slide-leave-left data-[state=open]:animate-slide-enter-left";
    default:
      return "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-[state=closed]:animate-slide-leave-right data-[state=open]:animate-slide-enter-right";
  }
}

export function SheetTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useSheet();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "sheet-trigger",
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

export function SheetClose(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useSheet();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "sheet-close",
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

export function SheetOverlay(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useSheet();
  const presence = createPresence(context.open);

  return (
    <Show when={presence.mounted()}>
      <div
        ref={presence.contentRef}
        data-slot="sheet-overlay"
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

export interface SheetContentProps extends PartProps {
  /** Which edge to slide in from. `"right"` by default. */
  side?: SheetSide;
}

export function SheetContent(props: SheetContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild", "side"]);
  const context = useSheet();
  const presence = createPresence(context.open);

  const side = (): SheetSide => local.side ?? "right";

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
        <SheetOverlay />
        <div
          ref={setPanel}
          data-slot="sheet-content"
          data-side={side()}
          data-state={presence.state()}
          id={context.contentId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={context.titleId}
          aria-describedby={context.descriptionId}
          tabindex={-1}
          class={cn(
            "fixed z-50 flex flex-col gap-4 bg-background p-6 shadow-lg",
            sideClasses(side()),
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

export function SheetHeader(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="sheet-header"
      class={cn("flex flex-col gap-2 text-center sm:text-left", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SheetFooter(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="sheet-footer"
      class={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function SheetTitle(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <h2
      id={useSheet().titleId}
      data-slot="sheet-title"
      class={cn("font-semibold", local.class)}
      {...rest}
    >
      {local.children}
    </h2>
  );
}

export function SheetDescription(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <p
      id={useSheet().descriptionId}
      data-slot="sheet-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
}