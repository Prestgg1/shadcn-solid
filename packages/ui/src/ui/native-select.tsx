import { For, type JSX, splitProps } from "solid-js";

import { cn } from "~/lib/cn";

export type NativeSelectSize = "sm" | "default";

type Part = { class?: string; children?: JSX.Element; [key: string]: unknown };

export interface NativeSelectProps extends Part {
  /** Declared explicitly rather than through `Omit`, which would widen
   *  `class` back to `unknown` because of the index signature. */
  size?: NativeSelectSize;
  value?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  onChange?: (event: Event & { currentTarget: HTMLSelectElement }) => void;
}

function ChevronDown(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * The platform's own `<select>`, styled.
 *
 * ```tsx
 * <NativeSelect onChange={(e) => setSort(e.currentTarget.value)}>
 *   <NativeSelectOption value="newest">Newest</NativeSelectOption>
 *   <NativeSelectOptGroup label="Priority">
 *     <NativeSelectOption value="high">High</NativeSelectOption>
 *   </NativeSelectOptGroup>
 * </NativeSelect>
 * ```
 *
 * Prefer `Select` when the list is long, needs search, or has descriptions
 * next to each option. Reach for this one when the options are few and the
 * native picker is genuinely better on the device — mobile, in particular.
 */
export function NativeSelect(props: NativeSelectProps): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "size", "children"]);

  return (
    <div
      data-slot="native-select-wrapper"
      class="group/native-select relative w-fit has-[select:disabled]:opacity-50"
    >
      <select
        data-slot="native-select"
        data-size={local.size ?? "default"}
        class={cn(
          "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed data-[size=sm]:h-8 data-[size=sm]:py-1 dark:bg-input/30 dark:hover:bg-input/50",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          local.class,
        )}
        {...rest}
      />
      <span
        data-slot="native-select-icon"
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
      >
        <ChevronDown />
      </span>
    </div>
  );
}

export function NativeSelectOption(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <option
      data-slot="native-select-option"
      class={cn("bg-[Canvas] text-[CanvasText]", local.class)}
      {...rest}
    />
  );
}

export function NativeSelectOptGroup(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return <optgroup data-slot="native-select-optgroup" class={local.class} {...rest} />;
}

export interface NativeSelectGroupItem {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Convenience for a plain list of options, without writing each one out. */
export function NativeSelectItems(props: { options: NativeSelectGroupItem[] }): JSX.Element {
  return (
    <For each={props.options}>
      {(option) => (
        <NativeSelectOption value={option.value} disabled={option.disabled}>
          {option.label}
        </NativeSelectOption>
      )}
    </For>
  );
}
