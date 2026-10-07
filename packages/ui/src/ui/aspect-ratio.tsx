import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

export interface AspectRatioProps {
  /** Width ÷ height. `16/9`, `1`, `2/3`. */
  ratio?: number;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A box that keeps a fixed width-to-height ratio as it resizes.
 *
 * Implemented with the `aspect-ratio` property rather than padding
 * percentages, so the child can be laid out normally inside it.
 *
 * ```tsx
 * <AspectRatio ratio={16 / 9}>
 *   <img src={cover} alt="" class="size-full object-cover" />
 * </AspectRatio>
 * ```
 */
export function AspectRatio(props: AspectRatioProps): JSX.Element {
  const [local, rest] = splitProps(props, ["ratio", "style"]);

  return (
    <div
      data-slot="aspect-ratio"
      style={{ "aspect-ratio": String(local.ratio ?? 1), ...(local.style as object) }}
      {...rest}
    />
  );
}
