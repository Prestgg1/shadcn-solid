import { createEffect } from "solid-js";

interface LockRecord {
  /** How many overlays currently hold a lock on this element. */
  count: number;
  /** Inline values captured when the first lock was taken, for restore. */
  paddingRight: string;
  overflow: string;
}

/**
 * One lock per nesting level, shared across every overlay in the app, so a
 * dialog opening a sheet does not restore scrolling when only the sheet
 * closes.
 */
const locks = new WeakMap<HTMLElement, LockRecord>();

/**
 * Prevent `element` from scrolling while `enabled()` is true.
 *
 * Reference-counted per element: every caller takes a lock on the way in
 * and releases its own on cleanup, and the inline styles are only restored
 * once the last holder lets go.
 */
export function scrollLock(element: HTMLElement | null, enabled: () => boolean): void {
  createEffect(
    () => (element ? enabled() : false) && typeof window !== "undefined",
    (shouldLock) => {
      if (!shouldLock || !element || typeof window === "undefined") return;

    const existing = locks.get(element);

    if (existing) {
      existing.count += 1;
    } else {
      // Pad by the scrollbar width so the page behind does not shift
      // sideways as the scrollbar disappears.
      const width = window.innerWidth - element.clientWidth;
      const currentPadding = Number.parseFloat(window.getComputedStyle(element).paddingRight) || 0;

      locks.set(element, {
        count: 1,
        paddingRight: element.style.paddingRight,
        overflow: element.style.overflow,
      });

      element.style.overflow = "hidden";
      if (width > 0) element.style.paddingRight = `${currentPadding + width}px`;
    }

      // Every holder releases its own lock, whichever branch it took above.
      // Returned rather than registered with `onCleanup`: in Solid 2 a
      // cleanup set inside an effect's apply phase never runs on dispose.
      return () => {
        const record = locks.get(element);
        if (!record) return;

        record.count -= 1;
        if (record.count > 0) return;

        locks.delete(element);
        element.style.overflow = record.overflow;
        element.style.paddingRight = record.paddingRight;
      };
    },
  );
}