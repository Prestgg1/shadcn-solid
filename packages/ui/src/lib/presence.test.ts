import { describe, expect, test } from "bun:test";
import { createRoot, createSignal, onMount } from "solid-js";
import { createPresence } from "./presence";

const tick = () => Promise.resolve();

/** Wait for a macrotask so animation-end timers and frames can settle. */
const settle = async (ms = 20) => {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * `createPresence` is driven by a signal, so the harness owns a root and a
 * setter, and the assertions run after Solid has flushed the effect.
 */
function presenceHarness(initial: boolean) {
  const holder = {} as {
    set: (next: boolean) => void;
    presence: ReturnType<typeof createPresence>;
    dispose: () => void;
  };

  createRoot((dispose) => {
    const [open, set] = createSignal(initial);
    holder.set = set;
    holder.presence = createPresence(open);
    holder.dispose = dispose;
  });

  return holder;
}

describe("createPresence", () => {
  test("is mounted and open when it starts open", async () => {
    const { presence, dispose } = presenceHarness(true);
    await tick();

    expect(presence.mounted()).toBe(true);
    expect(presence.state()).toBe("open");
    dispose();
  });

  test("is not mounted when it starts closed", async () => {
    const { presence, dispose } = presenceHarness(false);
    await tick();

    expect(presence.mounted()).toBe(false);
    expect(presence.state()).toBe("closed");
    dispose();
  });

  test("stays mounted while closing, then unmounts", async () => {
    const { set, presence, dispose } = presenceHarness(true);
    await tick();

    set(false);
    await tick();

    // The element is still in the DOM so the exit transition can run, and
    // `state` is what the CSS keys off.
    expect(presence.state()).toBe("closed");

    await settle();
    expect(presence.mounted()).toBe(false);
    dispose();
  });

  test("remounts on a second open", async () => {
    const { set, presence, dispose } = presenceHarness(true);
    await tick();

    set(false);
    await settle();
    expect(presence.mounted()).toBe(false);

    set(true);
    await tick();
    expect(presence.mounted()).toBe(true);
    expect(presence.state()).toBe("open");
    dispose();
  });

  test("waits for the element's animationend before unmounting", async () => {
    const { set, presence, dispose } = presenceHarness(true);
    await tick();

    const element = document.createElement("div");
    document.body.append(element);
    // Stand in for the animation the stylesheet would provide.
    element.style.animation = "fade-out 200ms ease";
    presence.contentRef(element);

    set(false);
    await tick();

    // The element exists and claims to animate, so presence holds it.
    await settle(5);
    expect(presence.mounted()).toBe(true);

    element.dispatchEvent(new Event("animationend"));
    await tick();
    expect(presence.mounted()).toBe(false);

    dispose();
  });

  test("ignores animationend bubbling up from a child", async () => {
    const { set, presence, dispose } = presenceHarness(true);
    await tick();

    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.append(child);
    document.body.append(parent);
    parent.style.animation = "fade-out 200ms ease";
    presence.contentRef(parent);

    set(false);
    await settle(5);

    child.dispatchEvent(new Event("animationend", { bubbles: true }));
    await tick();
    expect(presence.mounted()).toBe(true);

    parent.dispatchEvent(new Event("animationend"));
    await tick();
    expect(presence.mounted()).toBe(false);

    dispose();
  });

  test("unmounts promptly when nothing registered a ref", async () => {
    const { set, presence, dispose } = presenceHarness(true);
    await tick();

    set(false);
    await settle(5);
    expect(presence.mounted()).toBe(false);
    dispose();
  });

  test("opens and closes within a single component lifetime", async () => {
    let observed: (string | undefined)[] = [];
    let presence!: ReturnType<typeof createPresence>;

    createRoot((dispose) => {
      const [show, set] = createSignal(true);
      presence = createPresence(show);

      onMount(() => {
        observed.push(presence.state());
        // Close on the next tick, the way a dialog closes after a confirm.
        setTimeout(() => set(false), 0);
      });
      setTimeout(dispose, 40);
    });

    await settle(60);

    expect(observed).toEqual(["open"]);
    expect(presence.mounted()).toBe(false);
    expect(presence.state()).toBe("closed");
  });
});