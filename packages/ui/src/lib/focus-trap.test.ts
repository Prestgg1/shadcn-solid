import { afterEach, describe, expect, test } from "bun:test";
import { createRoot, createSignal } from "solid-js";
import { focusableWithin, focusTrap, type FocusTrapOptions } from "./focus-trap";

interface Harness {
  root: HTMLElement;
  trap: HTMLElement;
  setEnabled: (on: boolean) => void;
  dispose: () => void;
}

/**
 * Solid flushes `createEffect` on a microtask, so a harness that installs
 * listeners inside an effect has to hand back before assertions run.
 */
const tick = () => Promise.resolve();

/**
 * `focusTrap` installs document listeners inside `createEffect` and tears
 * them down on `onCleanup`, so it needs a live owner. Each test gets its
 * own root and disposes it — the same lifecycle a component has.
 */
async function setup(
  options: FocusTrapOptions = {},
  initialEnabled = true,
): Promise<Harness> {
  let harness!: Harness;

  createRoot((dispose) => {
    const [enabled, setEnabled] = createSignal(initialEnabled);

    const root = document.createElement("div");
    root.innerHTML = `
      <button data-testid="outside">outside</button>
      <div data-testid="trap">
        <button data-testid="first">first</button>
        <button data-autofocus data-testid="second">second</button>
        <button data-testid="third">third</button>
      </div>
    `;
    document.body.append(root);

    const trap = root.querySelector<HTMLElement>('[data-testid="trap"]')!;
    focusTrap(trap, enabled, options);

    harness = { root, trap, setEnabled, dispose };
  });

  await tick();
  return harness;
}

/** The same harness with no `[data-autofocus]` opt-in. */
async function setupWithoutAutofocus(): Promise<Harness> {
  let harness!: Harness;

  createRoot((dispose) => {
    const [enabled, setEnabled] = createSignal(true);

    const root = document.createElement("div");
    root.innerHTML = `<div data-testid="trap"><button data-testid="first">first</button></div>`;
    document.body.append(root);

    const trap = root.querySelector<HTMLElement>('[data-testid="trap"]')!;
    focusTrap(trap, enabled);

    harness = { root, trap, setEnabled, dispose };
  });

  await tick();
  return harness;
}

afterEach(() => {
  document.body.innerHTML = "";
});

const activeId = () => document.activeElement?.getAttribute("data-testid");

describe("focusableWithin", () => {
  test("finds focusable descendants in document order", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button id="a"></button><input id="b" /><div id="c" tabindex="0"></div>`;
    document.body.append(root);

    expect(focusableWithin(root).map((el) => el.id)).toEqual(["a", "b", "c"]);
  });

  test("excludes tabindex=-1, disabled, inert and aria-hidden elements", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button id="a"></button>
      <button id="minus" tabindex="-1"></button>
      <button id="off" disabled></button>
      <div inert><button id="in-inert"></button></div>
      <div aria-hidden="true"><button id="in-hidden"></button></div>
    `;
    document.body.append(root);

    expect(focusableWithin(root).map((el) => el.id)).toEqual(["a"]);
  });
});

describe("focusTrap", () => {
  test("focuses the [data-autofocus] element when it opens", async () => {
    const { dispose } = await setup();
    expect(activeId()).toBe("second");
    dispose();
  });

  test("focuses the container itself with focusContainer", async () => {
    const { trap, dispose } = await setup({ focusContainer: true });
    expect(document.activeElement).toBe(trap);
    dispose();
  });

  test("focuses the first focusable element when nothing opts in", async () => {
    const { dispose } = await setupWithoutAutofocus();
    expect(activeId()).toBe("first");
    dispose();
  });

  test("wraps Tab from the last item to the first", async () => {
    const { trap, dispose } = await setup();
    trap.querySelector<HTMLElement>('[data-testid="third"]')!.focus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    expect(activeId()).toBe("first");
    dispose();
  });

  test("wraps Shift+Tab from the first item to the last", async () => {
    const { trap, dispose } = await setup();
    trap.querySelector<HTMLElement>('[data-testid="first"]')!.focus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    );

    expect(activeId()).toBe("third");
    dispose();
  });

  test("pulls focus back when it escapes to the page behind", async () => {
    const { root, trap, dispose } = await setup();
    root.querySelector<HTMLElement>('[data-testid="outside"]')!.focus();

    expect(activeId()).not.toBe("outside");
    expect(trap.contains(document.activeElement)).toBe(true);
    dispose();
  });

  test("stops trapping once disabled", async () => {
    const { root, setEnabled, dispose } = await setup();
    setEnabled(false);
    await tick();

    const outside = root.querySelector<HTMLElement>('[data-testid="outside"]')!;
    outside.focus();

    expect(activeId()).toBe("outside");
    dispose();
  });

  test("does not steal focus while it starts disabled", async () => {
    const { dispose } = await setup({}, false);
    expect(activeId()).not.toBe("second");
    dispose();
  });
});