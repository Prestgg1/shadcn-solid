import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface SeparatorProps {
  class?: string;
  /** Which way the line runs. */
  orientation?: "horizontal" | "vertical";
  /**
   * When `true` the separator is hidden from assistive technology, which is
   * right for a divider between two paragraphs. Set it to `false` only when
   * the separator marks a real structural boundary.
   */
  decorative?: boolean;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A one-pixel rule.
 *
 * ```tsx
 * <Separator />
 * <Separator orientation="vertical" class="mx-2 h-4" />
 * ```
 */
export function Separator(props: SeparatorProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "orientation", "decorative"]);
  const decorative = () => local.decorative ?? true;
  const orientation = () => local.orientation ?? "horizontal";

  return (
    <Show
      when={!decorative()}
      fallback={
        <div
          data-slot="separator"
          data-orientation={orientation()}
          aria-hidden="true"
          class={cn(
            "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
            local.class,
          )}
          {...rest}
        />
      }
    >
      <div
        data-slot="separator"
        data-orientation={orientation()}
        role="separator"
        aria-orientation={orientation()}
        class={cn(
          "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
          local.class,
        )}
        {...rest}
      />
    </Show>
  );
}
