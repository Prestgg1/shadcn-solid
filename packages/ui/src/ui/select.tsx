import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { dismissable } from "~/lib/dismissable";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";

/**
 * Select — a listbox that opens into a floating panel.
 *
 * ```tsx
 * <Select value={value()} onValueChange={setValue}>
 *   <SelectTrigger><SelectValue /></SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="apple">Apple</SelectItem>
 *     <SelectItem value="pear">Pear</SelectItem>
 *   </SelectContent>
 * </Select>
 * ```
 *
 * **Reach for `NativeSelect` when you can.** A native `<select>` brings the
 * device's own picker — a wheel on iOS, a grid on Android, type-ahead on a
 * desktop — and it submits with the form for free. This one is for the cases
 * that genuinely need more: a long list with search, a description beside each
 * option, or a multi-select.
 *
 * Selection follows the WAI-ARIA listbox pattern: the trigger is a button
 * with `role="combobox"`, the panel is a `listbox`, and options carry
 * `role="option"` with `aria-selected`. Arrow keys move the *active* option and
 * Space or Enter commits it, so arrowing down a long list does not change the
 * value on every keypress.
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  value: () => string | undefined;
  select: (value: string) => void;
  /**
   * The label of the chosen option.
   *
   * Remembered at selection time rather than read from the panel, because the
   * panel is unmounted while the select is closed — so the item holding the
   * text is gone exactly when the text is needed. Radix keeps the selected
   * item mounted for the same reason.
   */
  label: () => string | undefined;
  /** Remember an option's text so the trigger can show it while closed. */
  rememberLabel: (label: string) => void;
  /** The option the keyboard is currently on, which is not necessarily the
   *  selected one. `undefined` until the panel opens. */
  active: () => string | undefined;
  setActive: (value: string | undefined) => void;
  register: (option: SelectOption) => void;
  options: () => SelectOption[];
  disabled: () => boolean;
  /** The trigger element, which is also the positioning reference. */
  trigger: () => HTMLElement | undefined;
  setTrigger: (element: HTMLElement) => void;
  contentId: string;
  triggerId: string;
}

const SelectContext = createContext<SelectContextValue>();

function useSelect(): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) throw new Error("Select parts must be used inside a <Select>.");
  return context;
}

/** Registry of the options currently rendered, kept in the order they appear. */
function createOptionRegistry() {
  const [registered, setRegistered] = createSignal<SelectOption[]>([]);

  return {
    options: () => registered(),
    register(option: SelectOption) {
      setRegistered((previous) =>
        previous.some((entry) => entry.value === option.value) ? previous : [...previous, option],
      );
    },
    /** The label of the first option registered — registration is DOM order. */
    first: () => registered()[0],
  };
}

export interface SelectProps {
  /** Controlled selection. Omit for an uncontrolled select. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: JSX.Element;
}

export function Select(props: SelectProps): JSX.Element {
  const [local] = split(props, ["value", "defaultValue", "onValueChange", "disabled", "children"]);

  const isControlled = () => local.value !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal(local.defaultValue);
  const value = (): string | undefined => (isControlled() ? local.value : uncontrolled());

  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal<string | undefined>();
  const [trigger, setTrigger] = createSignal<HTMLElement>();
  const registry = createOptionRegistry();

  const [label, setLabel] = createSignal<string>();

  const select = (next: string) => {
    if (!isControlled()) setUncontrolled(next);
    local.onValueChange?.(next);
    setActive(next);
    setOpen(false);
  };

  const id = createUniqueId();

  return (
    <SelectContext
      value={{
        open,
        setOpen,
        value,
        select,
        label,
        rememberLabel: setLabel,
        active,
        setActive,
        register: registry.register,
        options: registry.options,
        disabled: () => local.disabled ?? false,
        trigger,
        setTrigger,
        contentId: `select-${id}-content`,
        triggerId: `select-${id}-trigger`,
      }}
    >
      {local.children}
    </SelectContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function SelectTrigger(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const select = useSelect();

  return (
    <button
      ref={(element: HTMLButtonElement) => select.setTrigger(element)}
      type="button"
      id={select.triggerId}
      data-slot="select-trigger"
      data-state={select.open() ? "open" : "closed"}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={select.open() ? "true" : "false"}
      aria-controls={select.open() ? select.contentId : undefined}
      disabled={select.disabled()}
      class={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs",
        "transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        local.class,
      )}
      onClick={() => {
        if (select.disabled()) return;
        select.setOpen(!select.open());
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          // A closed select opens onto the first option rather than doing
          // nothing, which is what a keyboard user expects from the key.
          event.preventDefault();
          select.setOpen(true);
          select.setActive(select.options()[0]?.value);
        }
      }}
      {...rest}
    >
      {local.children}
      <SelectChevron />
    </button>
  );
}

function SelectChevron(): JSX.Element {
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
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export interface SelectValueProps extends PartProps {
  /** Shown when nothing is selected. Defaults to a dash. */
  placeholder?: string;
}

/** Renders the selected option's label. */
export function SelectValue(props: SelectValueProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "placeholder"]);
  const select = useSelect();

  // The panel's own label while it is mounted, the remembered one otherwise.
  const label = () =>
    select.options().find((option) => option.value === select.value())?.label ?? select.label();

  return (
    <span data-slot="select-value" class={cn("truncate", local.class)} {...rest}>
      {local.children ?? label() ?? local.placeholder ?? "—"}
    </span>
  );
}

export interface SelectContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function SelectContent(props: SelectContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "side", "sideOffset", "align"]);

  const select = useSelect();

  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "start";

  let panel: HTMLElement | undefined;

  const floating = floatingPanel(
    () => select.trigger(),
    () => panel,
    select.open,
    {
      placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
      offset: local.sideOffset ?? 4,
      sameWidth: true,
    },
  );

  dismissable(select.open, () => select.setOpen(false), {
    inside: () => panel,
    // A press on the trigger must not dismiss, or clicking it twice would
    // close the panel and immediately reopen it.
    outside: () => select.trigger(),
  });

  /**
   * Move the active option by `delta`, skipping anything disabled.
   *
   * Walks at most one full lap, so a run of disabled options at the end
   * cannot spin. With nothing active, a downward step starts at the top and
   * an upward one at the bottom — the two ends the user is likely aiming at.
   */
  const step = (delta: number) => {
    const list = select.options();
    if (list.length === 0) return;

    const at = list.findIndex((option) => option.value === select.active());
    const start = at === -1 ? (delta > 0 ? list.length - 1 : 0) : at;

    for (let offset = 1; offset <= list.length; offset += 1) {
      // `+ list.length` keeps the index positive for a backwards step.
      const next = list[(start + delta * offset + list.length) % list.length];
      if (next && !next.disabled) {
        select.setActive(next.value);
        return;
      }
    }
  };

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            panel = element;
            floating.presence.contentRef(element);
          }}
          data-slot="select-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          id={select.contentId}
          role="listbox"
          style={floating.style()}
          class={cn(
            "z-50 max-h-(--radix-select-content-available-height) min-w-32 overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden",
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
            if (event.key === "Home") {
              event.preventDefault();
              select.setActive(select.options().find((option) => !option.disabled)?.value);
            }
            if (event.key === "End") {
              event.preventDefault();
              select.setActive([...select.options()].reverse().find((option) => !option.disabled)?.value);
            }
            if (event.key === "Enter" || event.key === " ") {
              const current = select.active();
              if (current === undefined) return;
              event.preventDefault();
              select.select(current);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              select.setOpen(false);
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

/** A group of options under a heading. */
export function SelectGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "value"]);

  return (
    <div
      data-slot="select-group"
      role="group"
      data-value={local.value as string | undefined}
      class={cn("py-0.5", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export interface SelectItemProps extends PartProps {
  /** The value this option selects. */
  value: string;
  disabled?: boolean;
}

/** One option. Registers itself so keyboard navigation can find it. */
export function SelectItem(props: SelectItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "value", "disabled"]);
  const select = useSelect();

  const option: SelectOption = {
    value: local.value,
    label: String(local.children ?? local.value),
    disabled: local.disabled ?? false,
  };

  // Registered rather than read from the DOM: the option list is what the
  // arrow keys walk, and it has to be in DOM order without measuring anything.
  //
  // Deliberately never unregistered. The panel unmounts when it closes, but
  // `SelectValue` has to render the chosen option's label while it is closed —
  // which means the labels outlive the panel. A `Select` holds a fixed set of
  // options, so keeping them is a handful of strings; a list that genuinely
  // changes is what `Combobox` is for.
  select.register(option);
  // The first option to register is the one a freshly opened panel rests on,
  // in the same way a native select highlights its current value.
  if (select.active() === undefined) select.setActive(option.value);

  const selected = () => select.value() === local.value;
  const active = () => select.active() === local.value;

  // An option that is already the value on first mount — a controlled select
  // that opened with one — teaches the trigger its label.
  if (selected() && select.label() === undefined) select.rememberLabel(option.label);

  return (
    <div
      data-slot="select-item"
      data-state={selected() ? "checked" : "unchecked"}
      data-disabled={local.disabled ? "" : undefined}
      data-active={active() ? "" : undefined}
      role="option"
      aria-selected={selected() ? "true" : "false"}
      aria-disabled={local.disabled ? "true" : undefined}
      class={cn(
        "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
        "data-[active]:bg-accent data-[active]:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        local.class,
      )}
      onClick={() => {
        if (local.disabled) return;
        select.select(local.value);
      }}
      onPointerMove={() => {
        if (local.disabled) return;
        // Pointer and keyboard must not fight: moving the pointer settles the
        // active option so a subsequent Enter commits what is under it.
        select.setActive(local.value);
      }}
      {...rest}
    >
      {local.children}
      <Show when={selected()}>
        <span data-slot="select-item-indicator" class="absolute right-2 flex size-3.5 items-center justify-center">
          <CheckIcon />
        </span>
      </Show>
    </div>
  );
}

function CheckIcon(): JSX.Element {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Static text in the panel: a heading, or a "no results" line. */
export function SelectLabel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="select-label" class={cn("px-2 py-1.5 text-xs text-muted-foreground", local.class)} {...rest}>
      {local.children}
    </div>
  );
}

/** A horizontal rule between groups. */
export function SelectSeparator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return <div data-slot="select-separator" role="separator" class={cn("-mx-1 my-1 h-px bg-border", local.class)} {...rest} />;
}