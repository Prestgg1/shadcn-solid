import type { JSX } from "@solidjs/web";
import { For, Show, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * InputOTP — a one-time-code field split into boxes.
 *
 * ```tsx
 * <InputOTP maxLength={6} onComplete={(code) => verify(code)}>
 *   <InputOTPGroup>
 *     <InputOTPSlot index={0} />
 *     <InputOTPSlot index={1} />
 *     …
 *   </InputOTPGroup>
 * </InputOTP>
 * ```
 *
 * One hidden input holds the value, and the boxes are a *rendering* of it.
 * That is the whole design: a real `<input>` brings the mobile numeric
 * keyboard, paste, autofill of an SMS code, and the browser's own undo — none
 * of which six separate inputs get for free. Trying to build this out of six
 * inputs is the usual first attempt and it breaks on paste.
 *
 * Each box is a `<div>`, not an `<input>`, because an `<input>` announcing
 * itself as an editable field that is not would be a lie to a screen reader.
 * The real input carries the semantics; `aria-hidden` on the boxes keeps them
 * from being announced twice.
 */

export interface InputOTPProps {
  /** Number of digits. Also the number of `InputOTPSlot`s. */
  maxLength?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called once every slot is filled. */
  onComplete?: (value: string) => void;
  /** Only digits. On by default; turn it off for alphanumeric codes. */
  numeric?: boolean;
  disabled?: boolean;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

interface OtpState {
  value: () => string;
  set: (next: string) => void;
  maxLength: () => number;
  focused: () => boolean;
  setFocused: (next: boolean) => void;
  disabled: () => boolean;
  /** Whether a cursor would sit in front of this slot. */
  isActive: (index: number) => boolean;
}

const OtpContext = createContext<OtpState>();

export function InputOTP(props: InputOTPProps): JSX.Element {
  const [local, rest] = split(props, [
    "maxLength",
    "value",
    "defaultValue",
    "onValueChange",
    "onComplete",
    "numeric",
    "disabled",
    "class",
    "children",
  ]);

  const isControlled = () => local.value !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal(local.defaultValue ?? "");
  const [focused, setFocused] = createSignal(false);

  const maxLength = () => local.maxLength ?? 6;
  const value = (): string => (isControlled() ? (local.value ?? "") : uncontrolled());

  const set = (next: string) => {
    const cleaned = next
      // Pasted codes often arrive with spaces or dashes; the user's intent is
      // obvious, so strip them rather than rejecting the paste. Filtered
      // *before* the length cut, or a separator near the start would eat a
      // digit the user actually typed.
      .split("")
      .filter((character) => (local.numeric === false ? true : /\d/.test(character)))
      .join("")
      .slice(0, maxLength());

    if (cleaned === value()) return;

    if (!isControlled()) setUncontrolled(cleaned);
    local.onValueChange?.(cleaned);
    if (cleaned.length === maxLength()) local.onComplete?.(cleaned);
  };

  const otp: OtpState = {
    value,
    set,
    maxLength,
    focused,
    setFocused,
    disabled: () => local.disabled ?? false,
    isActive: (index) => focused() && index === value().length,
  };

  return (
    <OtpContext value={otp}>
      <div
        data-slot="input-otp"
        class={cn("flex items-center gap-2 has-disabled:opacity-50", local.class)}
        {...rest}
      >
        {/* The real input. `type="text"` with an inputmode, not
            `type="number"`: that silently drops anything non-numeric, and
            neither it nor a per-slot `maxlength` lets a whole pasted code in
            one go. */}
        <input
        data-slot="input-otp-field"
        type="text"
        inputmode={local.numeric === false ? "text" : "numeric"}
        autocomplete="one-time-code"
        autocorrect="off"
        spellcheck={false}
        aria-label="One-time code"
        maxlength={maxLength()}
        disabled={local.disabled}
        value={value()}
          class="sr-only"
          onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) =>
            set(event.currentTarget.value)
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={(event: ClipboardEvent) => {
            // A pasted code arrives as one string; the boxes are driven by
            // the value, so filling from the paste is all that is needed.
            event.preventDefault();
            set(`${value()}${event.clipboardData?.getData("text") ?? ""}`);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && value().length > 0) {
              event.preventDefault();
              set(value().slice(0, -1));
            }
          }}
        />
        {local.children}
      </div>
    </OtpContext>
  );
}

function useOtp(): OtpState {
  const otp = useContext(OtpContext);
  if (!otp) throw new Error("InputOTPSlot must be used inside an <InputOTP>.");
  return otp;
}

export function InputOTPGroup(props: { class?: string; children?: JSX.Element }): JSX.Element {
  const [local] = split(props, ["class", "children"]);
  return (
    <div data-slot="input-otp-group" class={cn("flex items-center gap-1", local.class)}>
      {local.children}
    </div>
  );
}

export interface InputOTPSlotProps {
  index: number;
  class?: string;
  [key: string]: unknown;
}

export function InputOTPSlot(props: InputOTPSlotProps): JSX.Element {
  const [local, rest] = split(props, ["index", "class"]);
  const otp = useOtp();

  const character = () => otp.value()[local.index] ?? "";

  return (
    <div
      data-slot="input-otp-slot"
      // Announced by the real input, not by 6 boxes that only look editable.
      aria-hidden="true"
      data-active={otp.isActive(local.index) ? "" : undefined}
      data-filled={character() ? "" : undefined}
      class={cn(
        "relative flex size-9 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all",
        "first:rounded-l-md first:border-l last:rounded-r-md",
        "data-active:z-10 data-active:border-ring data-active:ring-[3px] data-active:ring-ring/50",
        local.class,
      )}
      {...rest}
    >
      {character()}
      {/* The caret is drawn rather than a real one, because the boxes are not
          editable — a real caret would be a lie about where typing goes. */}
      <Show when={otp.isActive(local.index)}>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div class="h-4 w-px bg-foreground animate-caret-blink duration-1000" />
        </div>
      </Show>
    </div>
  );
}

export interface InputOTPSeparatorProps {
  class?: string;
  [key: string]: unknown;
}

export function InputOTPSeparator(props: InputOTPSeparatorProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      aria-hidden="true"
      class={cn("mx-1 text-muted-foreground", local.class)}
      {...rest}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
        <path d="M5 12h14" />
      </svg>
    </div>
  );
}

/** One slot per digit, for when the caller does not want to write them out. */
export function InputOTPSlots(props: { count?: number; class?: string }): JSX.Element {
  const [local] = split(props, ["count", "class"]);
  return (
    <InputOTPGroup class={local.class}>
      <For each={Array.from({ length: local.count ?? 6 }, (_, index) => index)}>
        {(index) => <InputOTPSlot index={index} />}
      </For>
    </InputOTPGroup>
  );
}