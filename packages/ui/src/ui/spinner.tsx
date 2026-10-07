import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface SpinnerProps {
  class?: string;
  /** Announced while loading. */
  label?: string;
  [key: string]: unknown;
}

/**
 * A loading indicator.
 *
 * ```tsx
 * <Spinner />
 * <Spinner label="Saving…" />
 * ```
 *
 * The arc is inline SVG rather than an icon library, so the component has no
 * dependency and inherits `currentColor`. `role="status"` makes the label
 * announced without stealing focus.
 */
export function Spinner(props: SpinnerProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "label"]);

  return (
    <svg
      data-slot="spinner"
      role="status"
      aria-label={local.label ?? "Loading"}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class={cn("size-4 animate-spin", local.class)}
      {...rest}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
      />
    </svg>
  );
}
