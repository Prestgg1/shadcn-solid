import type { ComponentProps, JSX } from "solid-js";
import { splitProps } from "solid-js";

import { asChild } from "~/lib/slot";
import { variants } from "~/lib/variants";

const badgeVariants = variants(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline: "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";

export interface BadgeProps extends ComponentProps<"span"> {
  variant?: BadgeVariant;
  /** Style the child element instead of a `<span>`, so a badge can be a link. */
  asChild?: boolean;
}

/**
 * A small status label.
 *
 * ```tsx
 * <Badge>Active</Badge>
 * <Badge variant="outline"><BadgeIcon />Beta</Badge>
 * ```
 */
export function Badge(props: BadgeProps): JSX.Element {
  const [local, rest] = splitProps(props, ["asChild", "children"]);
  const attributes = () => ({
    "data-slot": "badge",
    "data-variant": props.variant ?? "default",
    class: badgeVariants({ variant: props.variant, class: props.class }),
  });

  return props.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <span {...attributes()} {...rest}>
          {local.children}
        </span>
      );
}

export { badgeVariants };
