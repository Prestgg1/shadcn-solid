import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";
import { variants } from "~/lib/variants";

const alertVariants = variants(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type Part = { class?: string; children?: JSX.Element; [key: string]: unknown };

/**
 * A callout for a message tied to the page, not to a field.
 *
 * ```tsx
 * <Alert variant="destructive">
 *   <AlertCircleIcon />
 *   <AlertTitle>Payment failed</AlertTitle>
 *   <AlertDescription>Your card expired. Update it to keep using Pro.</AlertDescription>
 * </Alert>
 * ```
 *
 * Use `role="status"` instead when the message is an update rather than an
 * error — `role="alert"` interrupts what a screen reader is saying.
 */
export function Alert(props: Part & { variant?: "default" | "destructive" }): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <div
      data-slot="alert"
      role="alert"
      class={cn(alertVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
}

export function AlertTitle(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="alert-title"
      class={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", local.class)}
      {...rest}
    />
  );
}

export function AlertDescription(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="alert-description"
      class={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        local.class,
      )}
      {...rest}
    />
  );
}

export { alertVariants };
