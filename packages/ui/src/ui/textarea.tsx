import type { JSX, ComponentProps } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";

export interface TextareaProps extends ComponentProps<"textarea"> {}

/**
 * A multi-line input that grows with its content.
 *
 * ```tsx
 * <Textarea rows={3} placeholder="What happened?" />
 * ```
 */
export function Textarea(props: TextareaProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);

  return (
    <textarea
      data-slot="textarea"
      class={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        local.class,
      )}
      {...rest}
    />
  );
}
