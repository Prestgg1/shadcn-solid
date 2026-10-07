import type { JSX } from "@solidjs/web";
import { split } from "~/lib/split";

import { asChild } from "~/lib/slot";
import { variants } from "~/lib/variants";

const toggleVariants = variants(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 whitespace-nowrap transition-[color,box-shadow]",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground" },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5" } },
    defaultVariants: { variant: "default", size: "default" } },
);

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "default" | "sm" | "lg";

export interface ToggleProps {
  /** Whether the toggle is on. */
  pressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
  disabled?: boolean;
  class?: string;
  /** Accessible name when there is no visible label. */
  "aria-label"?: string;
  children?: JSX.Element;
  asChild?: boolean;
  [key: string]: unknown;
}

/**
 * A two-state button.
 *
 * ```tsx
 * <Toggle pressed={bold()} onPressedChange={setBold} aria-label="Bold">
 *   <BoldIcon />
 * </Toggle>
 * ```
 *
 * `role="button"` with `aria-pressed`, which is what distinguishes "on" for
 * a screen reader. `aria-label` is mandatory in practice: an icon-only
 * toggle has no text to announce.
 */
export function Toggle(props: ToggleProps): JSX.Element {
  const [local, rest] = split(props, [
    "asChild",
    "children",
    "pressed",
    "onPressedChange",
    "variant",
    "size",
    "disabled",
    "class",
    "aria-label",
  ]);
  const pressed = () => local.pressed ?? false;

  const attributes = () => ({
    type: "button" as const,
    "data-slot": "toggle",
    "data-state": pressed() ? "on" : "off",
    "aria-pressed": pressed() ? ("true" as const) : ("false" as const),
    disabled: local.disabled,
    "aria-label": local["aria-label"],
    class: toggleVariants({ variant: local.variant, size: local.size, class: local.class }),
    onClick: () => local.onPressedChange?.(!pressed()) });

  return props.asChild
    ? asChild(() => local.children ?? null, () => attributes())
    : (
        <button {...attributes()} {...rest}>
          {local.children}
        </button>
      );
}

export { toggleVariants };
