import { afterEach, describe, expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { rovingFocus } from "./roving-focus";

const tick = () => Promise.resolve();

afterEach(() => {
  document.body.innerHTML = "";
});

interface Harness {
  container: HTMLElement;
  handle: ReturnType<typeof rovingFocus>;
  dispose: () => void;
  ids: () => (string | null)[];
}

async function setup(
  options: Parameters<typeof rovingFocus>[1] = {},
  markup = `<button data-roving-item data-testid="a">a</button>
             <button data-roving-item data-testid="b">b</button>
             <button data-roving-item data-testid="c">c</button>`,
): Promise<Harness> {
  let harness!: Harness;

  createRoot((dispose) => {
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);

    const handle = rovingFocus(container, options);
    harness = { container, handle, dispose, ids: () => tabbable(container) };
  });

  await tick();
  return harness;
}

/** Ids of the items currently holding `tabindex="0"`. */
const tabbable = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-roving-item]"))
    .filter((el) => el.tabIndex === 0)
    .map((el) => el.getAttribute("data-testid"));

/** Focus the current tab stop, then press a key on it — as a user would. */
const press = (container: HTMLElement, key: string, shiftKey = false) => {
  const current = container.querySelector<HTMLElement>("[data-roving-item]:not([tabindex='-1'])")!;
  current.focus();
  current.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
};

const activeId = () => document.activeElement?.getAttribute("data-testid");

describe("rovingFocus", () => {
  test("makes exactly one item the tab stop", async () => {
    const { ids, dispose } = await setup();
    expect(ids()).toEqual(["a"]);
    dispose();
  });

  test("moves the tab stop and focus with ArrowRight", async () => {
    const { container, dispose } = await setup();
    press(container, "ArrowRight");
    expect(activeId()).toBe("b");
    dispose();
  });

  test("moves backwards with ArrowLeft", async () => {
    const { container, dispose } = await setup();
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    press(container, "ArrowLeft");
    expect(activeId()).toBe("b");
    dispose();
  });

  test("moves down with ArrowDown", async () => {
    const { container, dispose } = await setup();
    press(container, "ArrowDown");
    expect(activeId()).toBe("b");
    dispose();
  });

  test("ignores the cross-axis arrow", async () => {
    const { container, dispose } = await setup({ orientation: "horizontal" });
    press(container, "ArrowDown");
    expect(activeId()).toBe("a");
    dispose();
  });

  test("wraps past the last item", async () => {
    const { container, dispose } = await setup();
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    expect(activeId()).toBe("a");
    dispose();
  });

  test("stops at the ends when loop is off", async () => {
    const { container, dispose } = await setup({ loop: false });
    press(container, "ArrowLeft");
    expect(activeId()).toBe("a");
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    expect(activeId()).toBe("c");
    dispose();
  });

  test("jumps to the ends with Home and End", async () => {
    const { container, dispose } = await setup();
    press(container, "End");
    expect(activeId()).toBe("c");
    press(container, "Home");
    expect(activeId()).toBe("a");
    dispose();
  });

  test("selects on focus movement when asked", async () => {
    const selected: (string | null)[] = [];
    const { container, dispose } = await setup({
      selectOnFocus: true,
      onSelect: (el) => selected.push(el.getAttribute("data-testid")),
    });

    press(container, "ArrowRight");
    expect(selected).toEqual(["b"]);
    dispose();
  });

  test("does not select on focus movement by default", async () => {
    const selected: (string | null)[] = [];
    const { container, dispose } = await setup({ onSelect: (el) => selected.push(el.getAttribute("data-testid")) });

    press(container, "ArrowRight");
    expect(selected).toEqual([]);
    dispose();
  });

  test("skips disabled items", async () => {
    const { container, dispose } = await setup(
      {},
      `<button data-roving-item data-testid="a">a</button>
       <button data-roving-item data-testid="b" disabled>b</button>
       <button data-roving-item data-testid="c">c</button>`,
    );

    press(container, "ArrowRight");
    expect(activeId()).toBe("c");
    dispose();
  });

  test("skips aria-disabled items", async () => {
    const { container, dispose } = await setup(
      {},
      `<button data-roving-item data-testid="a">a</button>
       <button data-roving-item data-testid="b" aria-disabled="true">b</button>
       <button data-roving-item data-testid="c">c</button>`,
    );

    press(container, "ArrowRight");
    expect(activeId()).toBe("c");
    dispose();
  });

  test("adopts the active item when focus arrives from outside", async () => {
    const { container, dispose } = await setup();
    const last = container.querySelector<HTMLElement>('[data-testid="c"]')!;

    last.focus();
    expect(activeId()).toBe("c");
    // The tab stop followed focus, so there is still exactly one.
    expect(tabbable(container)).toEqual(["c"]);
    dispose();
  });

  test("focusItem moves focus to any item", async () => {
    const { container, handle, dispose } = await setup();
    const last = container.querySelector<HTMLElement>('[data-testid="c"]')!;

    handle.focusItem(last);
    expect(activeId()).toBe("c");
    expect(handle.active()).toBe(last);
    dispose();
  });

  test("starts on the item passed as initial", async () => {
    const markup = `<button data-roving-item data-testid="a">a</button>
                    <button data-roving-item data-testid="b">b</button>`;
    let harness!: Harness;
    createRoot((dispose) => {
      const container = document.createElement("div");
      container.innerHTML = markup;
      document.body.append(container);
      const initial = container.querySelector<HTMLElement>('[data-testid="b"]')!;
      const handle = rovingFocus(container, { initial });
      harness = { container, handle, dispose, ids: () => tabbable(container) };
    });
    await tick();

    expect(tabbable(harness.container)).toEqual(["b"]);
    harness.dispose();
  });

  test("detaches its listeners on dispose", async () => {
    const { container, dispose } = await setup();
    dispose();

    press(container, "ArrowRight");
    expect(activeId()).not.toBe("b");
  });
});