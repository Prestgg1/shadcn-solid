import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Tailwind-merge instance extended with our design-token scale, so that a
 * component default and a caller's `class` resolve to one winner instead of
 * both surviving into the stylesheet.
 *
 * The only additions are values this library adds on top of Tailwind's stock
 * scale: `text-md` (15px) and the `sm/md/lg/xl` radius tokens.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl"] }],
      rounded: [{ rounded: ["sm", "md", "lg", "xl"] }],
    },
  },
});

/**
 * Merge class names. Later classes win over earlier ones from the same
 * Tailwind group; everything else is concatenated.
 *
 * ```ts
 * cn("px-2 py-1", condition && "px-4")   // → "py-1 px-4"
 * ```
 *
 * This is the only class-merging helper in the library. Call sites never
 * reach for `!important` to win an argument against a component default —
 * they pass `class` and let `cn` decide.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };