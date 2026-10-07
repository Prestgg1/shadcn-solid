import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface SwitchProps {
  /** Controlled state. Omit for an uncontrolled switch. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  id?: string;
  class?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * An on/off toggle, built on a real checkbox input.
 *
 * ```tsx
 * <Switch id="digest" checked={weekly()} onChange={setWeekly} />
 * <Label for="digest">Weekly digest</Label>
 * ```
 *
 * A checkbox rather than a `<button role="switch">`, so the value reaches
 * the form on submit and Space toggles it for free. The thumb is drawn with
 * a gradient whose position is driven by `checked`.
 */
export function Switch(props: SwitchProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "checked", "onChange", "defaultChecked"]);

  const isChecked = () => local.checked ?? local.defaultChecked ?? false;

  return (
    <input
      type="checkbox"
      role="switch"
      data-slot="switch"
      checked={isChecked()}
      onChange={(event) => local.onChange?.(event.currentTarget.checked)}
      class={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none",
        "checked:bg-primary checked:shadow-xs",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        local.class,
      )}
      // The thumb is a gradient stop: 0% when off, 100% when on. That keeps
      // the animation in CSS with no second element to position.
      style={{
        "background-image":
          "linear-gradient(180deg, transparent 55%, white 55%), linear-gradient(0deg, white 55%, transparent 55%)",
        "background-position":
          isChecked() ? "calc(100% - 3px) calc(1.15rem/2 - 3.5px), calc(100% - 5.5px) calc(1.15rem/2 - 3.5px)"
                      : "3px calc(1.15rem/2 - 3.5px), 5.5px calc(1.15rem/2 - 3.5px)",
        "background-size":
          isChecked() ? "3px 7px, 3px 7px" : "3px 7px, 3px 7px",
        "background-repeat": "no-repeat",
        "transition": "background-position 120ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
      {...rest}
    />
  );
}
