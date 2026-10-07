import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { rovingFocus } from "~/lib/roving-focus";
import { split } from "~/lib/split";

/**
 * Accordion — several disclosures where opening one can close the others.
 *
 * ```tsx
 * <Accordion type="single" defaultValue="shipping">
 *   <AccordionItem value="shipping">
 *     <AccordionTrigger>Shipping</AccordionTrigger>
 *     <AccordionContent>Ships in 2–3 days.</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 *
 * Arrow keys move between triggers and the whole group is one tab stop,
 * which is what the roving-focus primitive is for.
 */

type AccordionValue = string | string[] | undefined;

interface AccordionContextValue {
  value: () => AccordionValue;
  toggle: (value: string) => void;
  disabled: () => boolean;
}

const AccordionContext = createContext<AccordionContextValue>();

/** One item's own state: which value it stands for, and where its ids are. */
const ItemContext = createContext<{
  value: () => string;
  open: () => boolean;
  disabled: () => boolean;
  triggerId: string;
  contentId: string;
}>();

export interface AccordionProps {
  /** `single` closes the others; `multiple` lets several stay open. */
  type?: "single" | "multiple";
  /** Which item is open. Uncontrolled when omitted. */
  value?: AccordionValue;
  defaultValue?: AccordionValue;
  onValueChange?: (value: AccordionValue) => void;
  disabled?: boolean;
  collapsible?: boolean;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function Accordion(props: AccordionProps): JSX.Element {
  const [local] = split(props, [
    "type",
    "value",
    "defaultValue",
    "onValueChange",
    "disabled",
    "collapsible",
    "class",
    "children",
  ]);

  const [uncontrolled, setUncontrolled] = createSignal<AccordionValue>(local.defaultValue);
  const isControlled = () => local.value !== undefined;
  const value = (): AccordionValue => (isControlled() ? local.value : uncontrolled());
  const single = () => (local.type ?? "single") === "single";

  const toggle = (next: string) => {
    if (local.disabled) return;

    const current = value();
    let updated: AccordionValue;

    if (single()) {
      // Clicking the open item closes it only when `collapsible` allows it,
      // matching the native `<details>` behaviour.
      updated = current === next ? (local.collapsible ? undefined : next) : next;
    } else {
      const open = Array.isArray(current) ? current : current ? [current] : [];
      updated = open.includes(next) ? open.filter((entry) => entry !== next) : [...open, next];
    }

    if (!isControlled()) setUncontrolled(updated);
    local.onValueChange?.(updated);
  };

  return (
    <AccordionContext
      value={{
        value,
        toggle,
        disabled: () => local.disabled ?? false,
      }}
    >
      <div
        data-slot="accordion"
        data-orientation="vertical"
        class={cn("flex w-full flex-col", local.class)}
      >
        <AccordionGroup>{local.children}</AccordionGroup>
      </div>
    </AccordionContext>
  );
}

/**
 * The roving-focus container.
 *
 * Separate from the visual wrapper so the listeners attach to an element
 * that exists for exactly as long as the group does.
 */
function AccordionGroup(props: { children?: JSX.Element }): JSX.Element {
  // A signal, not a plain variable: the element this component points at is
  // created by its own JSX below, which runs after this body. Reading a
  // variable here would hand `rovingFocus` an undefined container forever.
  const [group, setGroup] = createSignal<HTMLDivElement>();

  // One tab stop for the whole set; arrows move between triggers.
  rovingFocus(group, { orientation: "vertical", loop: true, selectOnFocus: false });

  return (
    <div ref={setGroup} data-slot="accordion-group" class="contents">
      {props.children}
    </div>
  );
}

export interface AccordionItemProps {
  value: string;
  disabled?: boolean;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function AccordionItem(props: AccordionItemProps): JSX.Element {
  const [local, rest] = split(props, ["value", "disabled", "class", "children"]);

  const group = useContext(AccordionContext);
  const base = createUniqueId();

  const open = (): boolean => {
    const current = group.value();
    return Array.isArray(current) ? current.includes(local.value) : current === local.value;
  };
  const disabled = (): boolean => (local.disabled ?? false) || group.disabled();

  return (
    <ItemContext
      value={{
        value: () => local.value,
        open,
        disabled,
        triggerId: `${base}-trigger`,
        contentId: `${base}-content`,
      }}
    >
      <div
        data-slot="accordion-item"
        data-state={open() ? "open" : "closed"}
        data-disabled={disabled() ? "" : undefined}
        class={cn("border-b last:border-b-0", local.class)}
        {...rest}
      >
        {local.children}
      </div>
    </ItemContext>
  );
}

export interface AccordionTriggerProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function AccordionTrigger(props: AccordionTriggerProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const item = useContext(ItemContext);
  const group = useContext(AccordionContext);

  return (
    <h3 data-slot="accordion-heading" class="flex">
      <button
        type="button"
        id={item.triggerId}
        data-slot="accordion-trigger"
        data-state={item.open() ? "open" : "closed"}
        data-disabled={item.disabled() ? "" : undefined}
        data-roving-item
        aria-expanded={item.open() ? "true" : "false"}
        aria-controls={item.contentId}
        disabled={item.disabled()}
        class={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none",
          "hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          "[&[data-state=open]>svg]:rotate-180",
          local.class,
        )}
        onClick={() => group.toggle(item.value())}
        {...rest}
      >
        {local.children}
      </button>
    </h3>
  );
}

export interface AccordionContentProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function AccordionContent(props: AccordionContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const item = useContext(ItemContext);

  return (
    <Show when={item.open()}>
      <div
        id={item.contentId}
        role="region"
        aria-labelledby={item.triggerId}
        data-slot="accordion-content"
        data-state={item.open() ? "open" : "closed"}
        class={cn("overflow-hidden text-sm", local.class)}
        {...rest}
      >
        <div class="pb-4 pt-0">{local.children}</div>
      </div>
    </Show>
  );
}
