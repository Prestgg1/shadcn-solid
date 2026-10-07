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
 * AlertDialog — a dialog that interrupts to confirm or deny.
 *
 * ```tsx
 * <AlertDialog>
 *   <AlertDialogTrigger asChild><Button variant="destructive">Delete</Button></AlertDialogTrigger>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>Delete this project?</AlertDialogTitle>
 *       <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>Cancel</AlertDialogCancel>
 *       <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 * ```
 *
 * The one behavioural difference from `Dialog` is the default focus: it
 * lands on **Cancel**, not on the action. A destructive confirmation whose
 * default focus is "Delete" is one Enter keypress from a data loss, so the
 * safe choice is the resting state.
 */

interface AlertDialogContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
}

const AlertDialogContext = createContext<AlertDialogContextValue>();

function useAlertDialog(): AlertDialogContextValue {
  return useContext(AlertDialogContext);
}

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}

export function AlertDialog(props: AlertDialogProps): JSX.Element {
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
    <AlertDialogContext
      value={{
        open,
        setOpen,
        contentId: `alert-dialog-${id}-content`,
        titleId: `alert-dialog-${id}-title`,
        descriptionId: `alert-dialog-${id}-description`,
      }}
    >
      {local.children}
    </AlertDialogContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

export function AlertDialogTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useAlertDialog();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "alert-dialog-trigger",
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

/**
 * The dismiss button.
 *
 * Closes without firing a value change — an alert dialog confirms with
 * `AlertDialogAction`, so this is only ever "go back".
 */
export function AlertDialogCancel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useAlertDialog();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "alert-dialog-cancel",
    class: cn("bg-muted text-foreground hover:bg-accent", local.class),
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
 * The confirm button. Closes on click, so an `onClick` handler of the
 * caller's runs first and the dialog unmounts after.
 */
export function AlertDialogAction(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useAlertDialog();

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "alert-dialog-action",
    class: cn("bg-destructive text-destructive-foreground hover:bg-destructive/90", local.class),
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

export function AlertDialogOverlay(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useAlertDialog();
  const presence = createPresence(context.open);

  return (
    <Show when={presence.mounted()}>
      <div
        ref={presence.contentRef}
        data-slot="alert-dialog-overlay"
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

export function AlertDialogContent(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  const context = useAlertDialog();
  const presence = createPresence(context.open);

  // A signal because the panel is created by the `<Show>` below, after this
  // body has run — a plain variable would leave the trap with no container.
  const [panel, setPanel] = createSignal<HTMLElement>();

  scrollLock(document.body, () => presence.mounted());

  focusTrap(panel, () => presence.mounted(), {
    // Cancel first in the DOM *and* focused first, so the resting state of a
    // destructive confirmation is the safe one.
    initialFocus: (container) =>
      container.querySelector<HTMLElement>('[data-slot="alert-dialog-cancel"]'),
  });

  dismissable(
    () => presence.mounted(),
    () => context.setOpen(false),
    { inside: panel },
  );

  return (
    <Show when={presence.mounted()}>
      <Portal>
        <AlertDialogOverlay />
        <div
          ref={setPanel}
          data-slot="alert-dialog-content"
          data-state={presence.state()}
          id={context.contentId}
          role="alertdialog"
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

export function AlertDialogHeader(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="alert-dialog-header"
      class={cn("flex flex-col gap-2 text-center sm:text-left", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function AlertDialogFooter(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <div
      data-slot="alert-dialog-footer"
      class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function AlertDialogTitle(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <h2
      id={useAlertDialog().titleId}
      data-slot="alert-dialog-title"
      class={cn("text-lg font-semibold", local.class)}
      {...rest}
    >
      {local.children}
    </h2>
  );
}

export function AlertDialogDescription(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "asChild"]);
  return (
    <p
      id={useAlertDialog().descriptionId}
      data-slot="alert-dialog-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </p>
  );
}