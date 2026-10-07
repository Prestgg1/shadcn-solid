import type { JSX } from "@solidjs/web";
import { Match, Show, Switch, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { rovingFocus } from "~/lib/roving-focus";
import { split } from "~/lib/split";

/**
 * Tabs — one visible panel at a time (or several, with `activationMode`).
 *
 * ```tsx
 * <Tabs defaultValue="account">
 *   <TabsList>
 *     <TabsTrigger value="account">Account</TabsTrigger>
 *     <TabsTrigger value="security">Security</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="account">…</TabsContent>
 * </Tabs>
 * ```
 *
 * Arrow keys move focus between triggers; Home and End jump to the ends. The
 * whole list is one tab stop, which is why the triggers carry
 * `data-roving-item` and the list wires up `rovingFocus`.
 */

interface TabsContextValue {
  value: () => string;
  setValue: (value: string) => void;
  orientation: () => "horizontal" | "vertical";
  activation: () => "automatic" | "manual";
  baseId: string;
}

const TabsContext = createContext<TabsContextValue>();

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  /**
   * `automatic` selects a panel as focus arrives there, the way a native
   * tablist does. `manual` waits for Enter or Space, which is what a tablist
   * whose panels are expensive to render wants.
   */
  activationMode?: "automatic" | "manual";
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function Tabs(props: TabsProps): JSX.Element {
  const [local] = split(props, [
    "defaultValue",
    "value",
    "onValueChange",
    "orientation",
    "activationMode",
    "class",
    "children",
  ]);

  const [uncontrolled, setUncontrolled] = createSignal(local.defaultValue ?? "");
  const isControlled = () => local.value !== undefined;
  const value = (): string => (isControlled() ? (local.value ?? "") : uncontrolled());

  const setValue = (next: string) => {
    if (!isControlled()) setUncontrolled(next);
    local.onValueChange?.(next);
  };

  return (
    <TabsContext
      value={{
        value,
        setValue,
        orientation: () => local.orientation ?? "horizontal",
        activation: () => local.activationMode ?? "automatic",
        baseId: "tabs",
      }}
    >
      <div
        data-slot="tabs"
        data-orientation={local.orientation ?? "horizontal"}
        class={cn(
          "flex gap-2",
          (local.orientation ?? "horizontal") === "vertical" && "flex-col",
          local.class,
        )}
      >
        {local.children}
      </div>
    </TabsContext>
  );
}

export interface TabsListProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function TabsList(props: TabsListProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const tabs = useContext(TabsContext);

  // A signal: this element is created by the JSX below, after the body has
  // run, so `rovingFocus` is handed an accessor rather than the value.
  const [list, setList] = createSignal<HTMLDivElement>();

  rovingFocus(list, {
    orientation: tabs.orientation(),
    // Wraps, matching a native tablist: the last tab's ArrowRight lands on
    // the first rather than dead-ending.
    loop: true,
    // Automatic activation switches panels as focus moves, matching a native
    // tablist. Manual waits for Enter or Space.
    selectOnFocus: tabs.activation() === "automatic",
    onSelect: (element) => {
      if (tabs.activation() === "automatic") tabs.setValue(element.getAttribute("data-value") ?? "");
    },
  });

  return (
    <div
      ref={setList}
      role="tablist"
      aria-orientation={tabs.orientation()}
      data-slot="tabs-list"
      data-orientation={tabs.orientation()}
      class={cn(
        "inline-flex w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground",
        tabs.orientation() === "vertical" && "w-full flex-col",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: string;
  class?: string;
  children?: JSX.Element;
  disabled?: boolean;
  [key: string]: unknown;
}

export function TabsTrigger(props: TabsTriggerProps): JSX.Element {
  const [local, rest] = split(props, ["value", "class", "children", "disabled"]);
  const tabs = useContext(TabsContext);
  const selected = () => tabs.value() === local.value;

  return (
    <button
      type="button"
      role="tab"
      id={`${tabs.baseId}-trigger-${local.value}`}
      aria-selected={selected() ? "true" : "false"}
      aria-controls={`${tabs.baseId}-content-${local.value}`}
      data-slot="tabs-trigger"
      data-roving-item
      data-state={selected() ? "active" : "inactive"}
      data-value={local.value}
      data-orientation={tabs.orientation()}
      disabled={local.disabled}
      tabindex={selected() ? 0 : -1}
      class={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium",
        "text-foreground transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "data-[state=active]:bg-background data-[state=active]:shadow-sm",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class,
      )}
      onClick={() => tabs.setValue(local.value)}
      onKeyDown={(event) => {
        // Manual activation still needs Enter and Space to select; arrows are
        // already handled by the roving-focus primitive.
        if (tabs.activation() !== "manual") return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        tabs.setValue(local.value);
      }}
      {...rest}
    >
      {local.children}
    </button>
  );
}

export interface TabsContentProps {
  value: string;
  class?: string;
  children?: JSX.Element;
  /** Keep the panel mounted while inactive. */
  forceMount?: boolean;
  [key: string]: unknown;
}

export function TabsContent(props: TabsContentProps): JSX.Element {
  const [local, rest] = split(props, ["value", "class", "children", "forceMount"]);
  const tabs = useContext(TabsContext);
  const selected = () => tabs.value() === local.value;

  return (
    <Switch
      fallback={
        <Show when={local.forceMount ?? false}>
          <div hidden>{local.children}</div>
        </Show>
      }
    >
      <Match when={selected()}>
        <div
          role="tabpanel"
          id={`${tabs.baseId}-content-${local.value}`}
          aria-labelledby={`${tabs.baseId}-trigger-${local.value}`}
          tabindex={0}
          data-slot="tabs-content"
          data-state={selected() ? "active" : "inactive"}
          class={cn("flex-1 outline-none", local.class)}
          {...rest}
        >
          {local.children}
        </div>
      </Match>
    </Switch>
  );
}
