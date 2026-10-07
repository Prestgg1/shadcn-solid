import type { JSX } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";

export interface ProgressProps {
  /** 0–100. */
  value?: number | null;
  class?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

function clamp(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * A progress bar.
 *
 * ```tsx
 * <Progress value={uploaded()} aria-label="Upload progress" />
 * ```
 *
 * Pass `null` for the indeterminate case: the bar runs on a sweep instead of
 * claiming a percentage, which is what `role="progressbar"` without a value
 * means. `aria-valuetext` is set so a screen reader says "Uploading" rather
 * than an unchanging number.
 */
export function Progress(props: ProgressProps): JSX.Element {
  const [local, rest] = split(props, ["class", "value"]);
  const value = () => local.value ?? null;
  const percent = () => clamp(value());

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value() === null ? undefined : percent()}
      aria-valuetext={value() === null ? "Loading" : undefined}
      {...rest}
      class={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", local.class)}
    >
      <div
        data-slot="progress-indicator"
        data-indeterminate={value() === null ? "" : undefined}
        class={cn(
          "h-full bg-primary transition-transform duration-300 ease-out",
          value() === null && "animate-[progress-sweep_1.4s_ease-in-out_infinite]",
        )}
        style={{
          transform:
            value() === null ? "translateX(-100%)" : `translateX(-${100 - percent()}%)`,
          width: value() === null ? "100%" : `${percent()}%` }}
      />
    </div>
  );
}
