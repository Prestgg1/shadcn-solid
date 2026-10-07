import { For, type JSX, splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface RadioOption {
  value: string;
  label: JSX.Element;
  description?: JSX.Element;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioOption[];
  /** Controlled value. Omit for an uncontrolled group. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Shared by every radio in the group, and what submits the value. */
  name: string;
  disabled?: boolean;
  class?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

type RowProps = {
  option: RadioOption;
  name: string;
  selected: boolean;
  onSelect: (value: string) => void;
  disabled?: boolean;
};

function RadioRow(props: RowProps): JSX.Element {
  const id = () => `${props.name}-${props.option.value}`;
  const disabled = () => props.disabled ?? props.option.disabled ?? false;

  return (
    <label
      for={id()}
      class={cn(
        "flex items-start gap-3 rounded-md border border-transparent p-2 transition-colors cursor-pointer",
        "has-[:checked]:border-primary has-[:checked]:bg-accent/50",
        disabled() && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        id={id()}
        name={props.name}
        value={props.option.value}
        checked={props.selected}
        disabled={disabled()}
        onChange={() => props.onSelect(props.option.value)}
        class={cn(
          "mt-0.5 size-4 shrink-0 appearance-none rounded-full border border-input text-primary shadow-xs",
          "checked:border-[5px]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
      <span class="grid gap-1">
        <span class="text-sm font-medium leading-none">{props.option.label}</span>
        {props.option.description && (
          <span class="text-sm text-muted-foreground">{props.option.description}</span>
        )}
      </span>
    </label>
  );
}

/**
 * A set of mutually exclusive options.
 *
 * ```tsx
 * <RadioGroup
 *   name="plan"
 *   value={plan()}
 *   onChange={setPlan}
 *   options={[
 *     { value: "monthly", label: "Monthly" },
 *     { value: "yearly", label: "Yearly", description: "Two months free" },
 *   ]}
 * />
 * ```
 *
 * Real radio inputs under a shared `name`, so arrow-key navigation, form
 * submit and the browser's own grouping all work without JavaScript. The
 * selected row is styled with `has-[:checked]`, so there is no second copy
 * of the selection state to keep in sync.
 */
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "class",
    "options",
    "value",
    "defaultValue",
    "onChange",
    "name",
    "disabled",
  ]);

  return (
    <div
      data-slot="radio-group"
      role="radiogroup"
      data-disabled={local.disabled ? "" : undefined}
      class={cn("grid gap-2", local.class)}
      {...rest}
    >
      <For each={local.options}>
        {(option) => (
          <RadioRow
            option={option}
            name={local.name}
            selected={(local.value ?? local.defaultValue) === option.value}
            onSelect={(next) => local.onChange?.(next)}
            disabled={local.disabled}
          />
        )}
      </For>
    </div>
  );
}