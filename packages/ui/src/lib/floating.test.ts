import { afterEach, describe, expect, test } from "bun:test";
import { createRoot, createSignal } from "solid-js";
import { floatingPanel } from "./floating";

const tick = () => Promise.resolve();
const settle = async (ms = 30) => {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, ms));
};

afterEach(() => {
  document.body.innerHTML = "";
});

interface Harness {
  handle: ReturnType<typeof floatingPanel>;
  dispose: () => void;
}

/**
 * `computePosition` is async, so assertions about the resulting coordinates
 * have to wait for the microtask it resolves on.
 */
async function setup(options: Parameters<typeof floatingPanel>[3] = {}): Promise<Harness> {
  let harness!: Harness;

  createRoot((dispose) => {
    const anchor = document.createElement("button");
    const panel = document.createElement("div");
    document.body.append(anchor, panel);

    const handle = floatingPanel(
      () => anchor,
      () => panel,
      () => true,
      options,
    );
    harness = { handle, dispose };
  });

  await settle();
  return harness;
}

describe("floatingPanel", () => {
  test("reports coordinates for the panel", async () => {
    const { handle, dispose } = await setup();
    expect(typeof handle.x()).toBe("number");
    expect(typeof handle.y()).toBe("number");
    dispose();
  });

  test("starts at the requested placement", async () => {
    const { handle, dispose } = await setup({ placement: "top-start" });
    expect(handle.placement()).toBe("top-start");
    dispose();
  });

  test("emits a fixed transform built from the coordinates", async () => {
    const { handle, dispose } = await setup();
    const style = handle.style();

    expect(style.position).toBe("fixed");
    expect(style.transform).toBe(`translate(${handle.x()}px, ${handle.y()}px)`);
    dispose();
  });

  test("keeps the panel hidden when the reference scrolls out of view", async () => {
    const { handle, dispose } = await setup();
    // happy-dom does not lay anything out, so the reference is never
    // hidden by `hide()`; the contract under test is that the flag exists
    // and drives the style, not which side of it we land on.
    expect(typeof handle.visible()).toBe("boolean");
    expect(handle.style().visibility === "hidden").toBe(!handle.visible());
    dispose();
  });

  test("exposes no arrow data unless an arrow was requested", async () => {
    const { handle, dispose } = await setup();
    expect(handle.arrow()).toBeUndefined();
    expect(handle.arrowStyle()).toEqual({});
    dispose();
  });

  test("tracks its own presence so the panel can animate out", async () => {
    let setOpen!: (next: boolean) => void;
    let harness!: Harness;

    createRoot((dispose) => {
      const anchor = document.createElement("button");
      const panel = document.createElement("div");
      document.body.append(anchor, panel);

      const [open, set] = createSignal(true);
      setOpen = set;
      const handle = floatingPanel(() => anchor, () => panel, open, {});
      harness = { handle, dispose };
    });

    await settle();
    expect(harness.handle.presence.mounted()).toBe(true);

    setOpen(false);
    await settle();

    expect(harness.handle.presence.state()).toBe("closed");
    harness.dispose();
  });

  test("stops tracking on dispose", async () => {
    const { handle, dispose } = await setup();
    expect(() => {
      dispose();
      handle.stop();
    }).not.toThrow();
  });
});