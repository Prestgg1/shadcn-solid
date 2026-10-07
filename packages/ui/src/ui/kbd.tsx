import type { JSX } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";

type Part = { class?: string; children?: JSX.Element; [key: string]: unknown };

/**
 * A keyboard key.
 *
 * ```tsx
 * <Kbd>K</Kbd>
 * <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
 * ```
 *
 * Inside a tooltip the background flips, so the key stays readable on the
 * tooltip's own surface rather than punching a hole in it.
 */
export function Kbd(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <kbd
      data-slot="kbd"
      class={cn(
        "pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        local.class,
      )}
      {...rest}
    />
  );
}

/** Several keys that are pressed together. */
export function KbdGroup(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <span data-slot="kbd-group" class={cn("inline-flex items-center gap-1", local.class)} {...rest} />
  );
}
