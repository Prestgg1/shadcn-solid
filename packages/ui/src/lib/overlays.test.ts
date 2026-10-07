import { afterEach, describe, expect, test } from "bun:test";
import { createRoot, createSignal } from "solid-js";
import { dismissable } from "./dismissable";
import { scrollLock } from "./scroll-lock";

const tick = () => Promise.resolve();

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.style.overflow = "";
});

describe("scrollLock", () => {
  test("locks and restores the inline overflow", async () => {
    const element = document.createElement("div");
    document.body.append(element);

    const holder = {} as { dispose: () => void };
    createRoot((dispose) => {
      scrollLock(element, () => true);
      holder.dispose = dispose;
    });
    await tick();

    expect(element.style.overflow).toBe("hidden");

    holder.dispose();
    expect(element.style.overflow).toBe("");
  });

  test("keeps an existing inline value", async () => {
    const element = document.createElement("div");
    element.style.overflow = "auto";
    document.body.append(element);

    const holder = {} as { dispose: () => void };
    createRoot((dispose) => {
      scrollLock(element, () => true);
      holder.dispose = dispose;
    });
    await tick();
    expect(element.style.overflow).toBe("hidden");

    holder.dispose();
    expect(element.style.overflow).toBe("auto");
  });

  test("counts nested locks and only restores on the last release", async () => {
    const element = document.createElement("div");
    document.body.append(element);

    const first = {} as { dispose: () => void };
    const second = {} as { dispose: () => void };

    createRoot((dispose) => {
      scrollLock(element, () => true);
      first.dispose = dispose;
    });
    createRoot((dispose) => {
      scrollLock(element, () => true);
      second.dispose = dispose;
    });
    await tick();

    // A dialog opening a sheet must not start scrolling when only the
    // sheet closes.
    first.dispose();
    expect(element.style.overflow).toBe("hidden");

    second.dispose();
    expect(element.style.overflow).toBe("");
  });

  test("does nothing while disabled", async () => {
    const element = document.createElement("div");
    document.body.append(element);

    createRoot((dispose) => {
      scrollLock(element, () => false);
      dispose();
    });
    await tick();

    expect(element.style.overflow).toBe("");
  });

  test("releases when the signal flips off", async () => {
    const element = document.createElement("div");
    document.body.append(element);

    createRoot((dispose) => {
      const [on, set] = createSignal(true);
      scrollLock(element, on);
      set(false);
      dispose();
    });
    await tick();

    expect(element.style.overflow).toBe("");
  });
});

describe("dismissable", () => {
  function setup(enabled = true) {
    const panel = document.createElement("div");
    panel.innerHTML = `<button data-testid="inside">inside</button>`;
    const trigger = document.createElement("button");
    document.body.append(trigger, panel);

    let closeCount = 0;
    const holder = {} as { dispose: () => void };

    createRoot((dispose) => {
      dismissable(
        () => enabled,
        () => {
          closeCount += 1;
        },
        { inside: () => panel, outside: () => trigger },
      );
      holder.dispose = dispose;
    });

    return { panel, trigger, holder, closeCount: () => closeCount };
  }

  const press = (element: Element) =>
    element.dispatchEvent(new Event("pointerdown", { bubbles: true }));

  test("closes on a pointer-down outside", async () => {
    const context = setup();
    await tick();

    const other = document.createElement("div");
    document.body.append(other);
    press(other);

    expect(context.closeCount()).toBe(1);
    context.holder.dispose();
  });

  test("ignores a pointer-down inside the panel", async () => {
    const context = setup();
    await tick();

    press(context.panel.querySelector('[data-testid="inside"]')!);

    expect(context.closeCount()).toBe(0);
    context.holder.dispose();
  });

  test("ignores a pointer-down on the trigger", async () => {
    const context = setup();
    await tick();

    press(context.trigger);

    expect(context.closeCount()).toBe(0);
    context.holder.dispose();
  });

  test("closes on Escape", async () => {
    const context = setup();
    await tick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(context.closeCount()).toBe(1);
    context.holder.dispose();
  });

  test("ignores keys other than Escape", async () => {
    const context = setup();
    await tick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(context.closeCount()).toBe(0);
    context.holder.dispose();
  });

  test("does nothing while disabled", async () => {
    const context = setup(false);
    await tick();

    press(document.body);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(context.closeCount()).toBe(0);
    context.holder.dispose();
  });

  test("detaches its listeners on dispose", async () => {
    const context = setup();
    await tick();
    context.holder.dispose();

    press(document.body);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(context.closeCount()).toBe(0);
  });

  test("can turn individual behaviours off", async () => {
    const panel = document.createElement("div");
    document.body.append(panel);

    let closeCount = 0;
    const holder = {} as { dispose: () => void };
    createRoot((dispose) => {
      dismissable(
        () => true,
        () => {
          closeCount += 1;
        },
        { inside: () => panel, pointerDown: false },
      );
      holder.dispose = dispose;
    });
    await tick();

    press(document.body);
    expect(closeCount).toBe(0);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(closeCount).toBe(1);

    holder.dispose();
  });
});