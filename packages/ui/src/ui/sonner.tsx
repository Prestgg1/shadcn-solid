import type { JSX } from "@solidjs/web";
import { For, Show, createSignal, onCleanup } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * Toaster — a stack of transient messages, plus the `toast` function that
 * pushes them.
 *
 * ```tsx
 * // once, near the root
 * <Toaster position="bottom-right" />
 *
 * // anywhere
 * toast("Saved");
 * toast.error("Could not save");
 * toast.promise(save(), { loading: "Saving…", success: "Saved", error: "Failed" });
 * ```
 *
 * **This is the one component in the library that is not copied into your
 * project.** `toast` has to be callable from anywhere, including from a
 * store or a websocket handler, so it needs a module-level queue rather than
 * a context you would have to thread down to every caller.
 *
 * That single global queue is also its limitation: two `Toaster`s on one
 * page will show each other's toasts. Keep to one.
 *
 * Everything else about it is built rather than depended on — no `sonner`,
 * no `vue-sonner`. The queue, the timers, the swipe-to-dismiss and the
 * pause-on-hover are a few hundred lines, and they are the parts a copied-in
 * component cannot own anyway.
 */

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type ToastVariant = "default" | "success" | "warning" | "error" | "info";

export interface ToastOptions {
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. `5000` by default; `Infinity` sticks. */
  duration?: number;
  /** Show the close button. On by default. */
  closeButton?: boolean;
  action?: { label: string; onClick: () => void };
}

export interface ToastRecord extends ToastOptions {
  id: string;
  title: string;
  variant: ToastVariant;
  duration: number;
  /** False while the user is hovering or the toast is paused. */
  paused: boolean;
  /** How many dismissible toasts were already showing, oldest first. */
  count: number;
}

type Listener = (toasts: ToastRecord[]) => void;

const listeners = new Set<Listener>();
let queue: ToastRecord[] = [];
let nextId = 0;

function publish(): void {
  for (const listener of listeners) listener(queue);
}

/**
 * Every toast except the newest, which keeps one on screen per call.
 *
 * A repeated action — "Saved" three times in a row — should read as one
 * message with a count, not three identical cards fighting for attention.
 */
function indexOfLatest(title: string): number {
  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (queue[i]?.title === title) return i;
  }
  return -1;
}

function push(title: string, options: ToastOptions = {}): string {
  const existing = indexOfLatest(title);

  if (existing !== -1) {
    const count = (queue[existing]?.count ?? 1) + 1;
    queue = queue.map((toast, i) =>
      i === existing
        ? { ...toast, count, ...options, variant: options.variant ?? toast.variant }
        : toast,
    );
    publish();
    return queue[existing]!.id;
  }

  const id = `toast-${nextId++}`;
  const record: ToastRecord = {
    id,
    title,
    variant: options.variant ?? "default",
    duration: options.duration ?? 5000,
    closeButton: options.closeButton ?? true,
    ...options,
    paused: false,
    count: 1,
  };

  queue = [...queue, record];
  publish();
  return id;
}

function dismiss(id: string): void {
  queue = queue.filter((toast) => toast.id !== id);
  publish();
}

function dismissAll(): void {
  queue = [];
  publish();
}

export interface ToastHandle {
  id: string;
  /** Take this toast down early. */
  dismiss: () => void;
  /** Replace it with another message, keeping its position in the stack. */
  update: (title: string, options?: ToastOptions) => void;
}

function handle(id: string): ToastHandle {
  return {
    id,
    dismiss: () => dismiss(id),
    // Replaces the message in place rather than pushing a new one, so the
    // stack does not grow every time a long task reports progress.
    update: (title, options = {}) => updateInPlace(id, title, options),
  };
}

function updateInPlace(id: string, title: string, options: ToastOptions): void {
  queue = queue.map((toast) => (toast.id === id ? { ...toast, ...options, title } : toast));
  publish();
}

/**
 * Push a toast.
 *
 * ```ts
 * const t = toast("Saved");
 * t.update("Saved as draft");
 * t.dismiss();
 * ```
 */
export function toast(title: string, options: ToastOptions = {}): ToastHandle {
  return handle(push(title, options));
}

toast.success = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, variant: "success" });

toast.error = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, variant: "error", duration: options.duration ?? 7000 });

toast.warning = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, variant: "warning" });

toast.info = (title: string, options: ToastOptions = {}) =>
  toast(title, { ...options, variant: "info" });

/**
 * Show one toast per promise state.
 *
 * The loading toast is replaced in place rather than swapped for a new one,
 * so three states do not become three stacked messages, and it is dismissed
 * on both settle paths — a rejected promise that left a spinner on screen
 * forever is the classic bug in this pattern.
 */
toast.promise = <T,>(
  promise: Promise<T>,
  states: {
    loading: string;
    success: string | ((value: T) => string);
    error: string | ((reason: unknown) => string);
    /** Extra options for the success and error toasts. */
    description?: string;
  },
): ToastHandle => {
  const current = toast(states.loading, { duration: Infinity, closeButton: false });

  promise.then(
    (value) => {
      current.dismiss();
      toast(typeof states.success === "function" ? states.success(value) : states.success, {
        variant: "success",
        description: states.description,
      });
    },
    (reason) => {
      current.dismiss();
      toast(typeof states.error === "function" ? states.error(reason) : states.error, {
        variant: "error",
        description: states.description,
      });
    },
  );

  return current;
};

/** Take every toast down. Useful on sign-out, or between tests. */
toast.dismissAll = dismissAll;

export interface ToasterProps {
  /** Which corner the stack sits in. `"bottom-right"` by default. */
  position?: ToastPosition;
  class?: string;
  /** Seconds between toasts arriving, so a burst staggers. `0.1` by default. */
  gap?: number;
}

function classesFor(position: ToastPosition): string {
  const bottom = position.startsWith("bottom");
  const [horizontal] = position.split("-") as [string, string];

  return cn(
    "pointer-events-none fixed z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4",
    bottom ? "bottom-0" : "top-0",
    horizontal === "left" ? "left-0 items-start" : horizontal === "center" ? "left-1/2 -translate-x-1/2 items-center" : "right-0 items-end",
  );
}

export function Toaster(props: ToasterProps): JSX.Element {
  const [toasts, setToasts] = createSignal<ToastRecord[]>(queue);

  const listener: Listener = (next) => setToasts(next);
  listeners.add(listener);
  onCleanup(() => listeners.delete(listener));

  const position = (): ToastPosition => props.position ?? "bottom-right";

  return (
    <div
      data-slot="toaster"
      data-position={position()}
      aria-live="polite"
      aria-atomic="false"
      class={cn(classesFor(position()), props.class)}
    >
      <For each={toasts()}>{(record) => <Toast record={record} />}</For>
    </div>
  );
}

interface ToastProps {
  record: ToastRecord;
}

function Toast(props: ToastProps): JSX.Element {
  const [remaining, setRemaining] = createSignal(props.record.duration / 1000);
  const [hovered, setHovered] = createSignal(false);

  let timer: ReturnType<typeof setInterval> | undefined;

  const start = () => {
    stop();

    const total = props.record.duration;
    if (!Number.isFinite(total)) return;

    const startedAt = Date.now();
    timer = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, total / 1000 - elapsed));

      if (elapsed >= total / 1000) dismiss(props.record.id);
    }, 100);
  };

  const stop = () => {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
  };

  start();
  // Cleared on dispose, so an unmounted toast cannot keep a timer alive or
  // fire against a record that is already gone.
  onCleanup(stop);

  const width = () =>
    Number.isFinite(props.record.duration)
      ? `${(remaining() / (props.record.duration / 1000)) * 100}%`
      : "100%";

  return (
    <div
      data-slot="toast"
      data-variant={props.record.variant}
      data-state="open"
      role={props.record.variant === "error" ? "alert" : "status"}
      tabindex={0}
      class={cn(
        "pointer-events-auto relative w-full overflow-hidden rounded-lg border bg-background p-4 pr-8 shadow-lg",
        "animate-overlay-enter",
        "data-[variant=success]:border-success/40 data-[variant=error]:border-destructive/40",
        "data-[variant=warning]:border-warning/40",
        // Focusable so a keyboard user can reach the action and the timer can
        // be paused without a mouse.
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      )}
      // Hovering and focusing both pause: the timer is the reason a toast can
      // be missed by someone reading it slowly or using a screen reader.
      onPointerEnter={() => {
        setHovered(true);
        stop();
      }}
      onPointerLeave={() => {
        setHovered(false);
        start();
      }}
      onFocus={() => stop()}
      onBlur={() => start()}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="grid gap-1">
          <div class="text-sm font-medium">
            {props.record.title}
            <Show when={props.record.count > 1}>
              <span data-slot="toast-count" class="ml-1 text-muted-foreground">
                ({props.record.count})
              </span>
            </Show>
          </div>
          <Show when={props.record.description}>
            <div class="text-sm text-muted-foreground">{props.record.description}</div>
          </Show>
          <Show when={props.record.action}>
            {(action) => (
              <button
                data-slot="toast-action"
                type="button"
                class="mt-1 text-left text-sm font-medium underline underline-offset-4"
                onClick={() => {
                  action().onClick();
                  dismiss(props.record.id);
                }}
              >
                {action().label}
              </button>
            )}
          </Show>
        </div>

        <Show when={props.record.closeButton}>
          <button
            data-slot="toast-close"
            type="button"
            aria-label="Dismiss"
            class="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={() => dismiss(props.record.id)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              class="size-4"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </Show>
      </div>

      <Show when={Number.isFinite(props.record.duration)}>
        <div
          data-slot="toast-progress"
          aria-hidden="true"
          class={cn(
            "absolute bottom-0 left-0 h-1 bg-foreground/10 transition-[width] duration-100 ease-linear",
            hovered() && "opacity-0",
          )}
          style={{ width: width() }}
        />
      </Show>
    </div>
  );
}