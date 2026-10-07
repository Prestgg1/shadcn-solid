import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface CardPartProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A surface with a header, content and footer.
 *
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Members</CardTitle>
 *     <CardDescription>People with access to this workspace.</CardDescription>
 *     <CardAction><Button size="sm">Invite</Button></CardAction>
 *   </CardHeader>
 *   <CardContent>…</CardContent>
 *   <CardFooter class="border-t">…</CardFooter>
 * </Card>
 * ```
 */
export function Card(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card"
      class={cn("flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm", local.class)}
      {...rest}
    />
  );
}

/**
 * Title, description and an action slot.
 *
 * The grid is two rows with `CardAction` spanning both, which is what keeps
 * an action button aligned to the top right without absolute positioning.
 */
export function CardHeader(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-header"
      class={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        local.class,
      )}
      {...rest}
    />
  );
}

export function CardTitle(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-title"
      class={cn("leading-none font-semibold", local.class)}
      {...rest}
    />
  );
}

export function CardDescription(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

/** Top-right slot for a single control: a menu, a button, a badge. */
export function CardAction(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-action"
      class={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", local.class)}
      {...rest}
    />
  );
}

export function CardContent(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div data-slot="card-content" class={cn("px-6", local.class)} {...rest} />
  );
}

export function CardFooter(props: CardPartProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-footer"
      class={cn("flex items-center px-6 [.border-t]:pt-6", local.class)}
      {...rest}
    />
  );
}