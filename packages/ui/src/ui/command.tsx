import type { JSX } from "@solidjs/web";
import { For, Show, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { split } from "~/lib/split";

/**
 * Command — a filterable list of commands.
 *
 * ```tsx
 * <Command>
 *   <CommandInput placeholder="Search…" />
 *   <CommandList>
 *     <CommandEmpty>Nothing found.</CommandEmpty>
 *     <CommandGroup heading="Suggestions">
 *       <CommandItem onSelect={open}>Open file…</CommandItem>
 *     </CommandGroup>
 *   </CommandList>
 * </Command>
 * ```
 *
 * Filtering is built in, and deliberately shallow: an item matches when its
 * **text** contains the query, case-insensitively. That is enough for a
 * command palette, and it is why `CommandItem` needs no `value` prop, no
 * keywords array and no filter function.
 *
 * **The DOM is the list.** Items hide themselves with `<Show>` rather than
 * being tracked in a registry, so what the arrow keys walk is exactly what is
 * on screen — no bookkeeping to drift when a list is generated, filtered or
 * emptied. The cost is a `querySelectorAll` per keypress, which for a command
 * palette's hundreds of items is not a cost worth optimising away.
 *
 * The highlight is stored as an item's *text* rather than an index, so it
 * survives the list being re-filtered underneath it.
 */

interface CommandContextValue {
  /** The current query. `CommandInput` writes it. */
  query: () => string;
  setQuery: (query: string) => void;
  /** The text of the highlighted item, or undefined for none. */
  active: () => string | undefined;
  setActive: (text: string | undefined) => void;
  /** Whether an item survives the current query. */
  matches: (text: string) => boolean;
  /** Move the highlight by `delta` through the visible items. */
  move: (delta: number) => void;
  /** Clear the query and the highlight. */
  reset: () => void;
  /** Run the highlighted item, as Enter does. */
  run: () => void;
}

const CommandContext = createContext<CommandContextValue>();

function useCommand(): CommandContextValue {
  const context = useContext(CommandContext);
  if (!context) throw new Error("Command parts must be used inside a <Command>.");
  return context;
}

export interface CommandProps {
  /** Controlled query. Omit to let the input own it. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Called when Escape is pressed. */
  onEscape?: () => void;
  /** Rendered inside the command, below the input. Defaults to `children`. */
  footer?: JSX.Element;
  children?: JSX.Element;
}

export function Command(props: CommandProps): JSX.Element {
  const [local] = split(props, ["value", "onValueChange", "onEscape", "footer", "children"]);

  const isControlled = () => local.value !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal("");
  const query = (): string => (isControlled() ? (local.value ?? "") : uncontrolled());

  const setQuery = (next: string) => {
    if (!isControlled()) setUncontrolled(next);
    local.onValueChange?.(next);
  };

  const [active, setActive] = createSignal<string>();
  let root: HTMLElement | undefined;

  const items = (): HTMLElement[] =>
    root
      ? Array.from(
          root.querySelectorAll<HTMLElement>('[data-slot="command-item"]:not([data-disabled])'),
        )
      : [];

  const textOf = (element: HTMLElement): string =>
    element.getAttribute("data-value") ?? element.textContent ?? "";

  const move = (delta: number) => {
    const list = items();
    if (list.length === 0) return;

    const current = list.findIndex((element) => textOf(element) === active());
    // From nothing highlighted, down starts at the top and up at the bottom
    // — the two ends a user is most likely aiming for.
    const from = current === -1 ? (delta > 0 ? -1 : 0) : current;
    const next = list[(from + delta + list.length) % list.length]!;

    setActive(textOf(next));
    // Scrolled into view by hand: the highlight can move without focus
    // following it, and an off-screen highlight is invisible.
    next.scrollIntoView({ block: "nearest" });
  };

  const run = () => {
    const current = items().find((element) => textOf(element) === active());
    // Enter runs the highlight rather than whatever last held DOM focus —
    // otherwise the pointer and the keyboard disagree about what Enter means.
    current?.click();
  };

  const context: CommandContextValue = {
    query,
    setQuery,
    active,
    setActive,
    matches: (text) => {
      const needle = query().trim().toLowerCase();
      // An empty query matches everything, which is what makes the list appear
      // complete before the user has typed anything.
      return needle === "" || text.toLowerCase().includes(needle);
    },
    move,
    run,
    reset: () => {
      setQuery("");
      setActive(undefined);
    },
  };

  return (
    <CommandContext value={context}>
      <div
        ref={(element: HTMLDivElement) => (root = element)}
        data-slot="command"
        class="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "Enter") {
            if (active() === undefined) return;
            event.preventDefault();
            run();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            local.onEscape?.();
          }
        }}
      >
        {local.children}
        <Show when={local.footer}>
          <div data-slot="command-footer" class="border-t p-1 text-xs text-muted-foreground">
            {local.footer}
          </div>
        </Show>
      </div>
    </CommandContext>
  );
}

export interface CommandInputProps {
  class?: string;
  children?: JSX.Element;
  asChild?: boolean;
  placeholder?: string;
  [key: string]: unknown;
}

export function CommandInput(props: CommandInputProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "placeholder", "asChild"]);
  const command = useCommand();

  const attributes = () => ({
    "data-slot": "command-input",
    type: "text" as const,
    role: "combobox" as const,
    "aria-expanded": "true" as const,
    "aria-autocomplete": "list" as const,
    placeholder: local.placeholder ?? "Type a command or search…",
    // A controlled input: the query is the source of truth, so clearing it
    // from anywhere restores the input too.
    value: command.query(),
    class: cn(
      "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
      local.class,
    ),
    onInput: (event: InputEvent & { currentTarget: HTMLInputElement }) => {
      command.setQuery(event.currentTarget.value);
      // A new query means a new list; the old highlight pointed at nothing.
      command.setActive(undefined);
    },
  });

  return local.asChild ? (
    asChild(() => local.children ?? null, attributes)
  ) : (
    <input {...attributes()} {...rest} />
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function CommandList(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);

  return (
    <div
      data-slot="command-list"
      role="listbox"
      class={cn("max-h-80 scroll-py-1 overflow-x-hidden overflow-y-auto", local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
}

/**
 * Shown when the query matches nothing.
 *
 * Rendered unconditionally rather than toggled, so the DOM stays stable while
 * typing — a list that rebuilds on every keystroke loses focus and scroll.
 */
export function CommandEmpty(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);

  return (
    <div data-slot="command-empty" class="py-6 text-center text-sm text-muted-foreground" {...rest}>
      {local.children ?? "No results found."}
    </div>
  );
}

export interface CommandGroupProps extends PartProps {
  heading?: string;
}

export function CommandGroup(props: CommandGroupProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "heading"]);

  return (
    <div
      data-slot="command-group"
      role="group"
      aria-label={local.heading as string | undefined}
      class={cn("overflow-hidden p-1 text-foreground", local.class)}
      {...rest}
    >
      <Show when={local.heading}>
        <div data-slot="command-group-heading" class="px-2 py-1.5 text-xs text-muted-foreground">
          {local.heading}
        </div>
      </Show>
      {local.children}
    </div>
  );
}

export interface CommandItemProps extends PartProps {
  /** The text the filter matches on. Defaults to the item's own text. */
  value?: string;
  disabled?: boolean;
  onSelect?: (value: string) => void;
}

export function CommandItem(props: CommandItemProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "value", "disabled", "onSelect"]);
  const command = useCommand();

  const text = () => String(local.value ?? local.children ?? "");

  return (
    <Show when={command.matches(text())}>
      <div
        data-slot="command-item"
        data-value={text()}
        data-active={command.active() === text() ? "" : undefined}
        data-disabled={local.disabled ? "" : undefined}
        role="option"
        aria-selected={command.active() === text() ? "true" : "false"}
        aria-disabled={local.disabled ? "true" : undefined}
        class={cn(
          "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
          "data-[active]:bg-accent data-[active]:text-accent-foreground",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          local.class,
        )}
        onPointerMove={() => {
          if (local.disabled) return;
          // Pointer and keyboard must not fight: whatever is under the cursor
          // is what Enter will run.
          command.setActive(text());
        }}
        onClick={() => {
          if (local.disabled) return;
          local.onSelect?.(text());
          command.reset();
        }}
        {...rest}
      >
        {local.children}
      </div>
    </Show>
  );
}

export function CommandSeparator(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div data-slot="command-separator" role="separator" class={cn("-mx-1 h-px bg-border", local.class)} {...rest} />
  );
}

export function CommandShortcut(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <span
      data-slot="command-shortcut"
      class={cn("ml-auto text-xs tracking-widest text-muted-foreground", local.class)}
      {...rest}
    >
      {local.children}
    </span>
  );
}

/** Renders each command from data. */
export function CommandItems(props: {
  items: { value: string; label?: string; onSelect?: (value: string) => void }[];
  class?: string;
}): JSX.Element {
  return (
    <For each={props.items}>
      {(item) => (
        <CommandItem value={item.value} onSelect={item.onSelect} class={props.class}>
          {item.label ?? item.value}
        </CommandItem>
      )}
    </For>
  );
}