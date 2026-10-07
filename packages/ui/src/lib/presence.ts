import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup } from "solid-js";

/** Frame helpers that degrade to synchronous calls outside the browser. */
const nextFrame: (cb: () => void) => void =
  typeof requestAnimationFrame === "function"
    ? (cb) => {
        requestAnimationFrame(cb);
      }
    : (cb) => cb();

function cancelFrame(id: number | undefined): void {
  if (id !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
}

/**
 * Resolve once the element has finished animating out, or immediately when
 * it never animates.
 *
 * The element is measured one frame *after* the caller asked us to leave,
 * because the closing state has to reach the DOM before a transition on it
 * can be observed. Racing `animationend`/`transitionend` against a timeout
 * keeps a skipped animation (reduced motion, `duration: 0`) from hanging.
 */
function afterAnimation(element: Element, done: () => void): () => void {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    element.removeEventListener("animationend", onEnd);
    element.removeEventListener("transitionend", onEnd);
    done();
  };

  function onEnd(event: Event) {
    if (event.target !== element) return;
    finish();
  }

  let frame: number | undefined;
  nextFrame(() => {
    frame = undefined;

    if (typeof window === "undefined" || !element.isConnected) {
      finish();
      return;
    }

    const style = window.getComputedStyle(element);
    const runs =
      style.animationName !== "none" ||
      (style.transitionProperty !== "none" && style.transitionDuration !== "0s");

    if (!runs) {
      finish();
      return;
    }

    element.addEventListener("animationend", onEnd);
    element.addEventListener("transitionend", onEnd);
    timer = setTimeout(finish, 1000);
  });

  return () => {
    cancelFrame(frame);
    finish();
  };
}

export interface Presence {
  /** Whether the subtree should be in the DOM. */
  mounted: Accessor<boolean>;
  /** `data-state` to render on the leaving element: `"open" | "closed"`. */
  state: Accessor<"open" | "closed">;
  /**
   * `ref` for the outermost element of the content. Presence needs it to
   * watch for the exit animation; `solid-js/web`'s `ref` prop works.
   */
  contentRef: (element: Element | undefined) => void;
}

/**
 * Keep a subtree mounted until its exit animation has played.
 *
 * ```tsx
 * const presence = createPresence(() => props.open);
 * <Show when={presence.mounted()}>
 *   <div ref={presence.contentRef} data-state={presence.state()}>…</div>
 * </Show>
 * ```
 *
 * Turning `when` off swaps `state` to `"closed"` (which is what the CSS
 * transition keys off) and holds `mounted` true until the animation ends.
 * Elements without a transition unmount on the next frame.
 */
export function createPresence(when: Accessor<boolean>): Presence {
  const [mounted, setMounted] = createSignal(when());
  const [state, setState] = createSignal<"open" | "closed">(when() ? "open" : "closed");

  let element: Element | undefined;
  let cancelExit: (() => void) | undefined;

  const unmount = () => {
    cancelExit?.();
    cancelExit = undefined;
    setMounted(false);
  };

  // `when` decides the branch; the DOM work belongs in the apply phase, so
  // the compute pass stays free of side effects.
  createEffect(
    () => when(),
    (visible) => {
      if (visible) {
        cancelExit?.();
        cancelExit = undefined;
        element = undefined;
        setState("open");
        setMounted(true);
        return;
      }

      if (!mounted()) return;

    setState("closed");
      if (element) {
        cancelExit?.();
        cancelExit = afterAnimation(element, unmount);
        return;
      }

      // Nothing registered a ref (or the caller has none): unmount promptly.
      nextFrame(unmount);
    },
  );

  onCleanup(() => cancelExit?.());

  return {
    mounted,
    state,
    contentRef(node) {
      element = node;
    },
  };
}