import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface CheckboxProps {
  /** Controlled state. Omit for an uncontrolled checkbox. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  /** The control's id, so a `<Label for>` can target it. */
  id?: string;
  class?: string;
  /** Accessible name when there is no visible `<Label>`. */
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * A checkbox, built on a real `<input type="checkbox">`.
 *
 * ```tsx
 * <Checkbox id="terms" checked={accepted()} onChange={setAccepted} />
 * <Label for="terms">I accept the terms</Label>
 * ```
 *
 * The native input is what makes this participate in a form submit and in
 * the browser's own validation; only the box is custom. An
 * `aria-invalid` here is picked up by the styling, so wiring it from the
 * form's error state is all that is needed.
 */
export function Checkbox(props: CheckboxProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "checked", "onChange", "defaultChecked"]);

  const isChecked = () => local.checked ?? local.defaultChecked ?? false;

  return (
    <input
      type="checkbox"
      role="checkbox"
      data-slot="checkbox"
      checked={isChecked()}
      onChange={(event) => local.onChange?.(event.currentTarget.checked)}
      class={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none",
        "checked:border-primary checked:bg-primary checked:text-primary-foreground",
        "indeterminate:border-primary indeterminate:bg-primary indeterminate:text-primary-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // The tick is drawn with a mask so it inherits `currentColor` and
        // needs no icon font.
        "checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%208.5l3%203%207-7%22%2F%3E%3C%2Fsvg%3E')] checked:bg-[length:100%_100%] checked:bg-no-repeat",
        "indeterminate:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22M3%208h10%22%2F%3E%3C%2Fsvg%3E')] indeterminate:bg-[length:100%_100%] indeterminate:bg-no-repeat",
        "appearance-none",
        local.class,
      )}
      {...rest}
    />
  );
}
