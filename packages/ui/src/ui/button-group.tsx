import type { JSX, ComponentProps } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";

export interface ButtonGroupProps extends ComponentProps<"div"> {
  /** How the buttons are joined. */
  orientation?: "horizontal" | "vertical";
}

/**
 * Joins several buttons into one control.
 *
 * ```tsx
 * <ButtonGroup>
 *   <Button variant="outline">Day</Button>
 *   <Button variant="outline">Week</Button>
 *   <Button variant="outline">Month</Button>
 * </ButtonGroup>
 * ```
 *
 * Children must be buttons, selects or inputs: the styles here use
 * `[&>:not(:first-child)]` and `:focus-visible` to collapse the borders and
 * move the ring, which only reads correctly on adjacent form controls.
 */
export function ButtonGroup(props: ButtonGroupProps): JSX.Element {
  const [local, rest] = split(props, ["class", "orientation"]);
  const orientation = () => local.orientation ?? "horizontal";
  const vertical = () => orientation() === "vertical";

  return (
    <div
      data-slot="button-group"
      data-orientation={orientation()}
      role="group"
      class={cn(
        "flex w-fit items-stretch [&>*]:focus-visible:relative [&>*]:focus-visible:z-10",
        "has-[>[data-slot=select]]:has-[>[data-slot=button-group]]:gap-2",
        vertical() ? "flex-col [&>[data-slot=select]]:w-full" : "flex-row [&>[data-slot=select]]:w-auto",
        "[&>[data-slot=button-group]]:flex [&>[data-slot=button-group]]:[&>*]:rounded-none",
        "[&>[data-slot=button-group]]:overflow-hidden",
        "gap-2",
        local.class,
      )}
      {...rest}
    />
  );
}
