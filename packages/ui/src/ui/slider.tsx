import type { JSX } from "solid-js";
import { createEffect, createSignal, splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export interface SliderProps {
  /** Controlled value. Omit for an uncontrolled slider. */
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Submits the value with the form. */
  name?: string;
  id?: string;
  class?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-valuetext"?: string;
}

/**
 * A range input.
 *
 * ```tsx
 * <Slider value={budget()} onChange={setBudget} min={0} max={100} step={5} />
 * ```
 *
 * A real `<input type="range">` sits invisibly over the track, so dragging,
 * arrow keys, Home/End and form submission all come from the platform
 * rather than from pointer maths. The visible track is two gradients whose
 * split point tracks the value.
 */
export function Slider(props: SliderProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "class",
    "value",
    "defaultValue",
    "onChange",
    "min",
    "max",
    "step",
    "disabled",
    "name",
  ]);

  const min = () => local.min ?? 0;
  const max = () => local.max ?? 100;

  const [position, setPosition] = createSignal(local.value ?? local.defaultValue ?? min());

  createEffect(() => {
    const next = local.value;
    if (next !== undefined && next !== position()) setPosition(next);
  });

  const percent = () => {
    const span = max() - min();
    if (span <= 0) return 0;
    return ((position() - min()) / span) * 100;
  };

  const sync = (event: Event & { currentTarget: HTMLInputElement }) => {
    const next = Number(event.currentTarget.value);
    setPosition(next);
    local.onChange?.(next);
  };

  return (
    <div
      data-slot="slider"
      class={cn("relative flex h-4 w-full touch-none select-none items-center", local.class)}
    >
      <div
        data-slot="slider-track"
        aria-hidden="true"
        class={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", local.disabled && "opacity-50")}
        style={{
          "background-image":
            "linear-gradient(var(--primary), var(--primary)), linear-gradient(var(--muted), var(--muted))",
          "background-size": `${percent()}% 100%, 100% 100%`,
          "background-repeat": "no-repeat",
        }}
      >
        <span
          data-slot="slider-thumb"
          class="block size-4 rounded-full border-2 border-primary bg-background shadow-sm"
        />
      </div>

      <input
        data-slot="slider-input"
        type="range"
        min={min()}
        max={max()}
        step={local.step ?? 1}
        value={position()}
        disabled={local.disabled}
        {...rest}
        onInput={sync}
        onChange={sync}
        class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
      />

      {/* The hidden input is what carries the value into a form submit; the
          range input above is presentational and carries no name. */}
      <input type="hidden" name={local.name} value={position()} data-slot="slider-value" />
    </div>
  );
}