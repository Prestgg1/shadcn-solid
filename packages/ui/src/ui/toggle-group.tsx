import type { JSX } from "@solidjs/web";
import { createContext, createMemo, createSignal, useContext } from "solid-js";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";
import { Toggle, type ToggleProps, type ToggleSize, type ToggleVariant } from "./toggle";

type GroupContextValue = {
  variant: () => ToggleVariant;
  size: () => ToggleSize;
  pressed: () => string[];
  onToggle: (value: string) => void;
};

const ToggleGroupContext = createContext<GroupContextValue>();

export type ToggleGroupSingleProps = Omit<ToggleProps, "pressed" | "onPressedChange" | "variant" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export type ToggleGroupMultipleProps = Omit<ToggleProps, "pressed" | "onPressedChange" | "variant" | "size"> & {
  value: string[];
  onValueChange: (value: string[]) => void;
};

export interface ToggleGroupBaseProps {
  variant?: ToggleVariant;
  size?: ToggleSize;
  class?: string;
  /** Turn one of them on at a time instead of allowing several. */
  single?: boolean;
  "aria-label"?: string;
  [key: string]: unknown;
}

export type ToggleGroupProps =
  | (ToggleGroupBaseProps & ToggleGroupSingleProps)
  | (ToggleGroupBaseProps & ToggleGroupMultipleProps);

/**
 * A toggle's own value shape: one string when single-select, a list when
 * several may be on. Narrowing on this is what lets the group call the right
 * `onValueChange` without a cast.
 */
export type ToggleValue = string | string[];

export function asToggleValue(value: ToggleValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * A set of toggles that behave as one control.
 *
 * ```tsx
 * // Several can be on
 * <ToggleGroup value={formats()} onValueChange={setFormats}>
 *   <ToggleGroupItem value="bold" aria-label="Bold"><BoldIcon /></ToggleGroupItem>
 *   <ToggleGroupItem value="italic" aria-label="Italic"><ItalicIcon /></ToggleGroupItem>
 * </ToggleGroup>
 *
 * // Only one at a time
 * <ToggleGroup single value={align()} onValueChange={setAlign}>…</ToggleGroup>
 * ```
 *
 * The group is a toolbar: one tab stop for the whole set, arrow keys moving
 * between items, which is what `Toolbar` here is for.
 */
export function ToggleGroup(props: ToggleGroupProps): JSX.Element {
  const [local, rest] = split(props as ToggleGroupBaseProps, ["class", "variant", "size", "single"]);

  const initial = (): string[] => asToggleValue((props as { value?: ToggleValue }).value);

  const [pressed, setPressed] = createSignal<string[]>(initial());
  const selected = createMemo(() => pressed());

  const onToggle = (value: string) => {
    const current = pressed();
    let next: string[];

    if (local.single) {
      next = current.includes(value) ? [] : [value];
    } else {
      next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
    }

    setPressed(next);

    // `single` and `value`'s shape travel together, so narrowing on one
    // narrows the other.
    const group = props as ToggleGroupBaseProps & {
      value?: ToggleValue;
      onValueChange?: (value: never) => void;
    };
    if (local.single) (group.onValueChange as ((v: string) => void) | undefined)?.(next[0] ?? "");
    else (group.onValueChange as ((v: string[]) => void) | undefined)?.(next);
  };

  const context: GroupContextValue = {
    variant: () => local.variant ?? "default",
    size: () => local.size ?? "default",
    pressed: selected,
    onToggle };

  // Solid 2 removed `Context.Provider`: the context object is itself the
  // provider component and takes the value as a prop.
  return (
    <ToggleGroupContext value={context}>
      <div
        data-slot="toggle-group"
        role="group"
        data-variant={local.variant ?? "default"}
        data-size={local.size ?? "default"}
        class={cn("group/toggle-group flex w-fit items-center rounded-md", local.class)}
        {...rest}
      />
    </ToggleGroupContext>
  );
}

export function ToggleGroupItem(props: ToggleGroupSingleProps | ToggleGroupMultipleProps): JSX.Element {
  const context = useContext(ToggleGroupContext);
  if (!context) throw new Error("ToggleGroupItem must be used inside a ToggleGroup.");

  // Both variants carry `value: string`; only the group's own `onValueChange`
  // differs, and that lives on the parent, not on the item.
  const value = (props as { value: string }).value;
  const item = () => ({ ...(props as ToggleGroupMultipleProps), value }) as ToggleProps;

  return (
    <Toggle
      variant={context.variant()}
      size={context.size()}
      pressed={context.pressed().includes(value)}
      onPressedChange={() => context.onToggle(value)}
      data-slot="toggle-group-item"
      {...item()}
    />
  );
}
