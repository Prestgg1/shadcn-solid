import type { JSX } from "@solidjs/web";
import { Show, createContext, createSignal, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { floatingPanel, type Placement } from "~/lib/floating";
import { Portal } from "~/lib/portal";
import { split } from "~/lib/split";

/**
 * Combobox — a text input that filters a list of options.
 *
 * ```tsx
 * <Combobox>
 *   <ComboboxAnchor>
 *     <ComboboxInput placeholder="Search countries…" />
 *     <ComboboxContent>
 *       <ComboboxList>
 *         <ComboboxEmpty>No country found.</ComboboxEmpty>
 *         <ComboboxItem value="Azerbaijan">Azerbaijan</ComboboxItem>
 *       </ComboboxList>
 *     </ComboboxContent>
 *   </ComboboxAnchor>
 * </Combobox>
 * ```
 *
 * Use it when the options need finding, not choosing — a country, a person, a
 * file. For a list of under about a dozen known values, `Select` or
 * `NativeSelect` is better: they show every option up front, and a native
 * `<select>` brings the device's own picker with it.
 *
 * The value is the option's **text**, matched as a case-insensitive substring
 * in either direction — so typing `brazil` finds `Brazil` and typing `bra`
 * finds it too. There is no separate `keywords` field, because for a list of
 * visible strings that is a second thing to keep in sync with the first.
 */

interface ComboboxContextValue {
  open: () => boolean;
  setOpen: (open: boolean) => void;
  query: () => string;
  setQuery: (query: string) => void;
  /** The option the keyboard is on. */
  active: () => string | undefined;
  setActive: (value: string | undefined) => void;
  matches: (text: string) => boolean;
  select: (value: string) => void;
  /** Move the highlight by `delta` through the visible options. */
  step: (delta: number) => void;
  anchor: () => HTMLElement | undefined;
  setAnchor: (element: HTMLElement) => void;
  /** The panel, which `step` walks. Set by `ComboboxContent`'s ref. */
  panel: () => HTMLElement | undefined;
  setPanel: (element: HTMLElement) => void;
  listId: string;
  inputId: string;
}

const ComboboxContext = createContext<ComboboxContextValue>();

function useCombobox(): ComboboxContextValue {
  const context = useContext(ComboboxContext);
  if (!context) throw new Error("Combobox parts must be used inside a <Combobox>.");
  return context;
}

export interface ComboboxProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Controlled query. Omit to let the input own it. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Called with the chosen option's text. */
  onSelect?: (value: string) => void;
  children?: JSX.Element;
}

export function Combobox(props: ComboboxProps): JSX.Element {
  const [local] = split(props, [
    "open",
    "defaultOpen",
    "onOpenChange",
    "value",
    "onValueChange",
    "onSelect",
    "children",
  ]);

  const openControlled = () => local.open !== undefined;
  const [openUncontrolled, setOpenUncontrolled] = createSignal(local.defaultOpen ?? false);
  const open = (): boolean => (openControlled() ? (local.open ?? false) : openUncontrolled());

  const setOpen = (next: boolean) => {
    if (!openControlled()) setOpenUncontrolled(next);
    local.onOpenChange?.(next);
  };

  const queryControlled = () => local.value !== undefined;
  const [queryUncontrolled, setQueryUncontrolled] = createSignal("");
  const query = (): string => (queryControlled() ? (local.value ?? "") : queryUncontrolled());

  const setQuery = (next: string) => {
    if (!queryControlled()) setQueryUncontrolled(next);
    local.onValueChange?.(next);
  };

  const [active, setActive] = createSignal<string>();
  const [anchor, setAnchor] = createSignal<HTMLElement>();
  const [panel, setPanel] = createSignal<HTMLElement>();
  const id = createUniqueId();

  const select = (value: string) => {
    setQuery(value);
    setOpen(false);
    local.onSelect?.(value);
  };

  /**
   * Move the highlight through the options currently on screen.
   *
   * Read from the DOM, like `Command` does: an item hides itself when the
   * query filters it out, so the rendered options are the only list that
   * cannot drift from what the user sees.
   */
  const step = (delta: number) => {
    const host = panel();
    const options = host
      ? Array.from(
          host.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]:not([data-disabled])'),
        )
      : [];
    if (options.length === 0) return;

    const textOf = (element: HTMLElement) => element.getAttribute("data-value") ?? "";
    const current = options.findIndex((element) => textOf(element) === active());

    const from = current === -1 ? (delta > 0 ? -1 : 0) : current;
    const next = options[(from + delta + options.length) % options.length]!;

    setActive(textOf(next));
    next.scrollIntoView({ block: "nearest" });
  };

  return (
    <ComboboxContext
      value={{
        open,
        setOpen,
        query,
        setQuery,
        active,
        setActive,
        matches: (text) => {
          const needle = query().trim().toLowerCase();
          return needle === "" || text.toLowerCase().includes(needle);
        },
        select,
        step,
        anchor,
        setAnchor,
        panel,
        setPanel,
        listId: `combobox-${id}-list`,
        inputId: `combobox-${id}-input`,
      }}
    >
      {local.children}
    </ComboboxContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/** The positioning box: the input, its label and the toggle, together. */
export function ComboboxAnchor(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const combobox = useCombobox();

  return (
    <div
      ref={(element: HTMLDivElement) => combobox.setAnchor(element)}
      data-slot="combobox-anchor"
      class={cn("relative flex w-full items-center gap-2", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export interface ComboboxInputProps extends PartProps {
  placeholder?: string;
  disabled?: boolean;
}

export function ComboboxInput(props: ComboboxInputProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "placeholder", "disabled"]);
  const combobox = useCombobox();

  return (
    <input
      id={combobox.inputId}
      data-slot="combobox-input"
      type="text"
      role="combobox"
      aria-expanded={combobox.open() ? "true" : "false"}
      aria-controls={combobox.listId}
      aria-autocomplete="list"
      autocomplete="off"
      placeholder={local.placeholder}
      disabled={local.disabled}
      // Controlled: clearing the query from anywhere restores the input.
      value={combobox.query()}
      class={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
        "transition-[color,box-shadow] outline-none placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) => {
        // Typing opens the panel: the list is the answer to what was just
        // typed, and making the user press a chevron to see it is a step
        // nobody asked for.
        combobox.setQuery(event.currentTarget.value);
        combobox.setActive(undefined);
        combobox.setOpen(true);
      }}
      onFocus={() => combobox.setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          combobox.setOpen(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          combobox.setOpen(false);
        }
      }}
      {...rest}
    />
  );
}

export interface ComboboxContentProps extends PartProps {
  side?: Placement;
  sideOffset?: number;
  align?: "start" | "center" | "end";
}

export function ComboboxContent(props: ComboboxContentProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "side", "sideOffset", "align"]);

  const combobox = useCombobox();
  const side = (): Placement => local.side ?? "bottom";
  const align = () => local.align ?? "start";

  // The panel lives in the context so `step` can walk the rendered options.
  const floating = floatingPanel(combobox.anchor, combobox.panel, combobox.open, {
    placement: (align() === "center" ? side() : `${side()}-${align()}`) as Placement,
    offset: local.sideOffset ?? 4,
    sameWidth: true,
  });

  return (
    <Show when={floating.presence.mounted()}>
      <Portal>
        <div
          ref={(element: HTMLElement) => {
            combobox.setPanel(element);
            floating.presence.contentRef(element);
          }}
          data-slot="combobox-content"
          data-state={floating.presence.state()}
          data-side={floating.placement()}
          style={floating.style()}
          class={cn(
            "z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden",
            "data-[state=closed]:animate-overlay-leave data-[state=open]:animate-overlay-enter",
            local.class,
          )}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              combobox.step(1);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              combobox.step(-1);
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

export function ComboboxList(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const combobox = useCombobox();

  return (
    <div
      data-slot="combobox-list"
      id={combobox.listId}
      role="listbox"
      class={cn("max-h-64 overflow-y-auto", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

/** Rendered unconditionally, so the list does not rebuild while typing. */
export function ComboboxEmpty(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="combobox-empty" class="py-6 text-center text-sm text-muted-foreground" {...rest}>
      {local.children ?? "No results found."}
    </div>
  );
}

export interface ComboboxItemProps extends PartProps {
  /** The text, and the value reported by `onSelect`. */
  value?: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
}

export function ComboboxItem(props: ComboboxItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "value", "disabled", "onSelect"]);
  const combobox = useCombobox();

  const text = () => String(local.value ?? local.children ?? "");

  return (
    <Show when={combobox.matches(text())}>
      <div
        data-slot="combobox-item"
        data-value={text()}
        data-active={combobox.active() === text() ? "" : undefined}
        data-disabled={local.disabled ? "" : undefined}
        role="option"
        aria-selected={combobox.active() === text() ? "true" : "false"}
        aria-disabled={local.disabled ? "true" : undefined}
        class={cn(
          "relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
          "data-[active]:bg-accent data-[active]:text-accent-foreground",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          local.class,
        )}
        onClick={() => {
          if (local.disabled) return;
          combobox.select(text());
          local.onSelect?.(text());
        }}
        onPointerMove={() => {
          if (local.disabled) return;
          combobox.setActive(text());
        }}
        {...rest}
      >
        {local.children}
      </div>
    </Show>
  );
}

export function ComboboxGroup(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="combobox-group" role="group" class={cn(local.class)} {...rest}>
      {local.children}
    </div>
  );
}

export function ComboboxSeparator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return <div data-slot="combobox-separator" role="separator" class={cn("-mx-1 h-px bg-border", local.class)} {...rest} />;
}

export function ComboboxLabel(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <div data-slot="combobox-label" class={cn("px-2 py-1.5 text-xs text-muted-foreground", local.class)} {...rest}>
      {local.children}
    </div>
  );
}