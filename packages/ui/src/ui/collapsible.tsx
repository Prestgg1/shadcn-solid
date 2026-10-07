import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

interface CollapsibleContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  disabled: () => boolean;
}

const CollapsibleContext = createContext<CollapsibleContextValue>();

export interface CollapsibleProps {
  /** Controlled open state. Omit for an uncontrolled collapsible. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true the trigger does nothing and reads as disabled. */
  disabled?: boolean;
  class?: string;
  children?: JSX.Element;
}

/**
 * A disclosure: one region that can be shown or hidden.
 *
 * ```tsx
 * <Collapsible>
 *   <CollapsibleTrigger>Advanced</CollapsibleTrigger>
 *   <CollapsibleContent>…</CollapsibleContent>
 * </Collapsible>
 * ```
 *
 * Uncontrolled by default — pass `open` and `onOpenChange` to drive it.
 * `data-state` on the root is what the trigger and content style off, so
 * either can be restyled without touching this component.
 */
export function Collapsible(props: CollapsibleProps): JSX.Element {
  const [local] = split(props, ["open", "defaultOpen", "onOpenChange", "disabled", "class", "children"]);

  const [uncontrolled, setUncontrolled] = createSignal(local.defaultOpen ?? false);
  const isControlled = () => local.open !== undefined;
  const isOpen = (): boolean => isControlled() ? (local.open ?? false) : uncontrolled();

  const setOpen = (next: boolean) => {
    if (local.disabled) return;
    if (!isControlled()) setUncontrolled(next);
    local.onOpenChange?.(next);
  };

  // Solid 2's context object is itself the provider component and takes the
  // value as a prop; there is no `Context.Provider`.
  return (
    <CollapsibleContext
      value={{
        open: isOpen,
        setOpen,
        disabled: () => local.disabled ?? false,
      }}
    >
      <div
        data-slot="collapsible"
        data-state={isOpen() ? "open" : "closed"}
        data-disabled={local.disabled ? "" : undefined}
        class={cn("group/collapsible", local.class)}
      >
        {local.children}
      </div>
    </CollapsibleContext>
  );
}

export interface CollapsibleTriggerProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/** The button that opens and closes the region. */
export function CollapsibleTrigger(props: CollapsibleTriggerProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const context = useContext(CollapsibleContext);
  const open = (): boolean => context.open();

  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      data-state={open() ? "open" : "closed"}
      data-disabled={context.disabled() ? "" : undefined}
      aria-expanded={open() ? "true" : "false"}
      disabled={context.disabled()}
      class={cn(local.class)}
      onClick={() => context.setOpen(!open())}
      {...rest}
    >
      {local.children}
    </button>
  );
}

export interface CollapsibleContentProps {
  class?: string;
  children?: JSX.Element;
  /** Keep the region mounted while closed, so its contents keep their state. */
  forceMount?: boolean;
  [key: string]: unknown;
}

/** The hidden region. */
export function CollapsibleContent(props: CollapsibleContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "forceMount"]);
  const context = useContext(CollapsibleContext);
  const open = (): boolean => context.open();

  return (
    <Show when={open() || (local.forceMount ?? false)}>
      <div
        data-slot="collapsible-content"
        data-state={open() ? "open" : "closed"}
        hidden={!open()}
        class={cn(local.class)}
        {...rest}
      >
        {local.children}
      </div>
    </Show>
  );
}