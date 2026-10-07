import type { JSX, ComponentProps } from "@solidjs/web";
import { split } from "~/lib/split";

import { asChild } from "~/lib/slot";
import { variants } from "~/lib/variants";

const buttonVariants = variants(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline" },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10" } },
    defaultVariants: { variant: "default", size: "default" } },
);

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

export type ButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Style the child element instead of rendering a `<button>`, so a link can
   * look like a button:
   *
   * ```tsx
   * <Button asChild><a href="/docs">Docs</a></Button>
   * ```
   *
   * Only for elements that already behave like the target — never to bolt
   * button behaviour onto a `<div>`.
   */
  asChild?: boolean;
}

/**
 * The attributes a button renders with.
 *
 * Both the default path and the `asChild` path go through this, so a link
 * styled as a button is identical to a real button apart from the tag.
 */
function buttonAttributes(props: ButtonProps) {
  const variant = props.variant ?? "default";
  const size = props.size ?? "default";

  return {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    class: buttonVariants({ variant, size, class: props.class }) };
}

/**
 * The button — the component every other one is built around.
 *
 * ```tsx
 * <Button size="sm">Save</Button>
 * <Button variant="destructive">Delete</Button>
 * <Button size="icon" aria-label="Settings"><SettingsIcon /></Button>
 * <Button asChild><a href="/docs">Docs</a></Button>
 * ```
 */
export function Button(props: ButtonProps): JSX.Element {
  const [local, rest] = split(props, ["asChild", "children"]);

  return props.asChild
    ? asChild(() => local.children ?? null, () => buttonAttributes(props))
    : (() => {
        const attributes = buttonAttributes(props);
        return (
          <button {...attributes} {...rest}>
            {local.children}
          </button>
        );
      })();
}

export { buttonVariants };