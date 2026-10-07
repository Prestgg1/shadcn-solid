import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface LabelProps {
  class?: string;
  /** The `id` of the control this labels. */
  for?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A form label.
 *
 * ```tsx
 * <Label for="email">Email</Label>
 * <Input id="email" />
 * ```
 *
 * The `for`/`id` pairing is what makes the label click-to-focus and what a
 * screen reader announces; never rely on wrapping alone.
 */
export function Label(props: LabelProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <label
      data-slot="label"
      class={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        local.class,
      )}
      {...rest}
    />
  );
}
