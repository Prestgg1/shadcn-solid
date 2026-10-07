import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { dismissable } from "~/lib/dismissable";
import { focusTrap } from "~/lib/focus-trap";
import { Portal } from "~/lib/portal";
import { createPresence } from "~/lib/presence";
import { scrollLock } from "~/lib/scroll-lock";
import { asChild } from "~/lib/slot";
import { split } from "~/lib/split";

/**
 * Dialog — a modal window over the page.
 *
 * ```tsx
 * <Dialog open={open()} onOpenChange={setOpen}>
 *   <DialogTrigger asChild><Button>Edit</Button></DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Edit task</DialogTitle>
 *       <DialogDescription>Changes save immediately.</DialogDescription>
 *     </DialogHeader>
 *     …
 *   </DialogContent>
 * </Dialog>
 * ```
 *
 * The panel is named by `aria-labelledby` pointing at `DialogTitle`, rather
 * than by an `aria-label` repeating the title — that way the accessible name
 * comes from the text the user can actually see.
 *
 * Escape closes, the scrim closes, Tab is confined while open, the page
 * behind cannot scroll, and focus returns to the trigger on close. All of
 * that is wired into `DialogContent` rather than left to the caller, because
 * a dialog that leaks focus is the most common accessibility bug a
 * component like this can ship.
 */

interface DialogContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  /** The element focus returns to on close. */
  trigger: () => HTMLElement | null;
  setTrigger: (element: HTMLElement) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
}

const DialogContext = createContext<DialogContextValue>();

function useDialog(): DialogContextValue {
  return useContext(DialogContext);
}

export interface DialogProps {
  /** Controlled open state. Omit for an uncontrolled dialog. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function Dialog(props: DialogProps): JSX.Element {
  const [local] = split(props, ["open", "defaultOpen", "onOpenChange", "children"]);

  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const isControlled = () => local.open !== undefined;
  const open = (): boolean => (isControlled() ? (local.open ?? false) : uncontrolled());

  const setOpen = (next: boolean) => {
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  let trigger: HTMLElement | undefined;

  // One id, three suffixes: the content, title and description reference each
  // other, and `aria-labelledby` needs a stable string per dialog.
  const id = createUniqueId();

  return (
    <DialogContext
      value={{
        open,
        setOpen,
        trigger: () => trigger ?? null,
        setTrigger: (element) => (trigger = element),
        contentId: `dialog-${id}-content`,
        titleId: `dialog-${id}-title`,
        descriptionId: `dialog-${id}-description`,
      }}
    >
      {local.children}
    </DialogContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  /** Style the caller's own element instead of the one this renders. */
  asChild?: boolean;
  [key: string]: unknown;
}

/** Opens the dialog. */
export function DialogTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDialog();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "dialog-trigger",
    "data-state": context.open() ? ("open" as const) : ("closed" as const),
    "aria-expanded": context.open() ? ("true" as const) : ("false" as const),
    "aria-haspopup": "dialog" as const,
    "aria-controls": context.contentId,
    class: cn(local.class),
    onClick: () => context.setOpen(true),
  });

  return local.asChild
    ? asChild(
        () => local.children ?? null,
        () => ({
          ...attributes(),
          ref: (element: HTMLElement) => context.setTrigger(element),
        }),
      )
    : (
        <button
          ref={(element: HTMLButtonElement) => context.setTrigger(element)}
          {...attributes()}
          {...rest}
        >
          {local.children}
        </button>
      );
}

/** Closes the dialog. */
export function DialogClose(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDialog();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "dialog-close",
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

/**
 * The scrim behind the panel.
 *
 * Separate from the content so the panel can be laid out independently of
 * the scrim's own padding and centring. Clicks on it are handled by
 * `dismissable` inside `DialogContent`, so it works standalone too.
 */
export function DialogOverlay(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDialog();
  const presence = createPresence(context.open);

  return (
    <Show when={presence.mounted()}>
      <div
        ref={presence.contentRef}
        data-slot="dialog-overlay"
        data-state={presence.state()}
        class={cn(
          "fixed inset-0 z-50 bg-black/55",
          "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
          local.class,
        )}
        {...rest}
      >
        {local.children}
      </div>
    </Show>
  );
}

/**
 * The panel, portalled to `document.body`.
 *
 * Everything modal about the dialog is set up here — the scrim, the focus
 * trap, the scroll lock, Escape and outside-press dismissal — so a caller
 * cannot get a half-modal dialog by nesting differently.
 */
export function DialogContent(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useDialog();
  const presence = createPresence(context.open);

  // A signal, not a plain variable: the panel is created by the `<Show>`
  // below, which runs *after* this component body. The focus trap tracks its
  // container, so a plain assignment here would leave it pointing at `null`
  // forever and the dialog would never trap or focus anything.
  const [panel, setPanel] = createSignal<HTMLElement>();

  scrollLock(document.body, () => presence.mounted());

  focusTrap(panel, () => presence.mounted(), {
    // Focus the panel rather than its first control: on a dialog the first
    // control is usually "Close", and announcing that first is unhelpful.
    focusContainer: true,
  });

  dismissable(
    () => presence.mounted(),
    () => context.setOpen(false),
    { inside: panel },
  );

  return (
    <Show when={presence.mounted()}>
      <Portal>
        <DialogOverlay />
        <div
          ref={setPanel}
          data-slot="dialog-content"
          data-state={presence.state()}
          id={context.contentId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={context.titleId}
          aria-describedby={context.descriptionId}
          tabindex={-1}
          class={cn(
            "fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4",
            "rounded-lg border bg-background p-6 shadow-lg",
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

export function DialogHeader(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="dialog-header"
      class={cn("flex flex-col gap-2 text-center sm:text-left", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function DialogFooter(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="dialog-footer"
      class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function DialogTitle(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <h2
      id={useDialog().titleId}
      data-slot="dialog-title"
      class={cn("text-lg font-semibold", local.class)}
      {...rest}
    >
      {local.children}
    </h2>
  );
}

export function DialogDescription(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <p
      id={useDialog().descriptionId}
      data-slot="dialog-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
}