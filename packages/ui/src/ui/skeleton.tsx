import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface SkeletonProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A pulsing placeholder for content that has not loaded.
 *
 * Give it the shape of what it replaces — a skeleton with the wrong height
 * makes the page jump when the data arrives.
 *
 * ```tsx
 * <Skeleton class="h-4 w-32" />
 * ```
 */
export function Skeleton(props: SkeletonProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      class={cn("animate-pulse rounded-md bg-accent", local.class)}
      {...rest}
    />
  );
}
