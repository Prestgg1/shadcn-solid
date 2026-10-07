import type { JSX } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";
import { variants } from "~/lib/variants";

type Part = { class?: string; children?: JSX.Element; [key: string]: unknown };

/**
 * The "nothing here yet" state.
 *
 * ```tsx
 * <Empty>
 *   <EmptyHeader>
 *     <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
 *     <EmptyTitle>No tasks yet</EmptyTitle>
 *     <EmptyDescription>Create your first task to get started.</EmptyDescription>
 *   </EmptyHeader>
 *   <EmptyContent>
 *     <Button><PlusIcon />New task</Button>
 *   </EmptyContent>
 * </Empty>
 * ```
 *
 * An empty list with no explanation reads as broken, so this is where the
 * reason and the way out belong.
 */
export function Empty(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div
      data-slot="empty"
      class={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
        local.class,
      )}
      {...rest}
    />
  );
}

export function EmptyHeader(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div
      data-slot="empty-header"
      class={cn("flex max-w-sm flex-col items-center gap-2 text-center", local.class)}
      {...rest}
    />
  );
}

const emptyMediaVariants = variants(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6" } },
    defaultVariants: { variant: "default" } },
);

/** The illustration or icon above the message. */
export function EmptyMedia(props: Part & { variant?: "default" | "icon" }): JSX.Element {
  const [local, rest] = split(props, ["class", "variant"]);
  return (
    <div
      data-slot="empty-icon"
      data-variant={local.variant ?? "default"}
      class={cn(emptyMediaVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
}

export function EmptyTitle(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div
      data-slot="empty-title"
      class={cn("text-lg font-medium tracking-tight", local.class)}
      {...rest}
    />
  );
}

export function EmptyDescription(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <p
      data-slot="empty-description"
      class={cn("text-muted-foreground text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4", local.class)}
      {...rest}
    />
  );
}

/** The way out of the empty state: a button, a link, a filter reset. */
export function EmptyContent(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div
      data-slot="empty-content"
      class={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        local.class,
      )}
      {...rest}
    />
  );
}

export { emptyMediaVariants };
