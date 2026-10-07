import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

/** Drain effects and the frame the exit animation unmounts on. */
const settle = async () => {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.resolve();
  }
};

const Fruit = (props: { value?: string; onValueChange?: (v: string) => void }) => (
  <Select value={props.value} onValueChange={props.onValueChange}>
    <SelectTrigger aria-label="Fruit">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="apple">Apple</SelectItem>
      <SelectItem value="pear">Pear</SelectItem>
      <SelectItem value="plum" disabled>
        Plum
      </SelectItem>
      <SelectItem value="fig">Fig</SelectItem>
    </SelectContent>
  </Select>
);

describe("Select", () => {
  test("the trigger is a combobox, closed until it is opened", () => {
    const { container } = render(() => <Fruit />);
    const trigger = container.querySelector<HTMLElement>("button")!;

    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(slot("select-content")).toBeNull();
  });

  test("opens the listbox on click", async () => {
    const { container } = render(() => <Fruit />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    expect(slot("select-content")?.getAttribute("role")).toBe("listbox");
    expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
  });

  test("remembers the chosen label, so a closed trigger still shows it", async () => {
    const { container } = render(() => <Fruit />);

    await fireEvent.click(container.querySelector("button")!);
    await settle();
    await fireEvent.click(document.querySelectorAll('[data-slot="select-item"]')[1]!);
    await settle();

    // The panel is gone, so this can only work if the label was kept.
    expect(slot("select-content")).toBeNull();
    expect(slot("select-value")?.textContent).toBe("Pear");
  });

  test("falls back to a placeholder when nothing is selected", () => {
    render(() => <Fruit />);
    expect(slot("select-value")?.textContent).toBe("—");
  });

  test("marks the selected option checked", async () => {
    const { container } = render(() => <Fruit value="apple" />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    const options = document.querySelectorAll<HTMLElement>('[data-slot="select-item"]');
    expect(options[0]!.getAttribute("aria-selected")).toBe("true");
    expect(options[1]!.getAttribute("aria-selected")).toBe("false");
  });

  test("choosing an option reports it and closes the panel", async () => {
    let chosen: string | undefined;
    const { container } = render(() => <Fruit onValueChange={(v) => (chosen = v)} />);

    await fireEvent.click(container.querySelector("button")!);
    await settle();
    await fireEvent.click(document.querySelectorAll('[data-slot="select-item"]')[1]!);
    await settle();

    expect(chosen).toBe("pear");
    expect(slot("select-content")).toBeNull();
  });

  test("a disabled option cannot be chosen", async () => {
    let chosen: string | undefined;
    const { container } = render(() => <Fruit onValueChange={(v) => (chosen = v)} />);

    await fireEvent.click(container.querySelector("button")!);
    await settle();
    await fireEvent.click(document.querySelectorAll('[data-slot="select-item"]')[2]!);
    await settle();

    expect(chosen).toBeUndefined();
  });

  test("ArrowDown opens the panel onto the first option", async () => {
    const { container } = render(() => <Fruit />);
    const trigger = container.querySelector("button")!;

    await fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await settle();

    expect(slot("select-content")).not.toBeNull();
    expect(document.querySelector('[data-slot="select-item"][data-active]')?.textContent).toBe("Apple");
  });

  test("arrows move the active option without changing the value", async () => {
    let chosen: string | undefined;
    const { container } = render(() => <Fruit onValueChange={(v) => (chosen = v)} />);

    await fireEvent.keyDown(container.querySelector("button")!, { key: "ArrowDown" });
    await settle();

    const panel = slot("select-content")!;
    await fireEvent.keyDown(panel, { key: "ArrowDown" });
    await settle();

    // Arrowing past an option must not select it, or scrolling a long list
    // would change the value on every keypress.
    expect(chosen).toBeUndefined();
    expect(document.querySelector('[data-slot="select-item"][data-active]')?.textContent).toBe("Pear");
  });

  test("arrows skip a disabled option", async () => {
    const { container } = render(() => <Fruit />);
    await fireEvent.keyDown(container.querySelector("button")!, { key: "ArrowDown" });
    await settle();

    const panel = slot("select-content")!;
    // The panel opens resting on Apple. One step lands on Pear; the next
    // skips Plum, which is disabled, and lands on Fig.
    await fireEvent.keyDown(panel, { key: "ArrowDown" });
    await fireEvent.keyDown(panel, { key: "ArrowDown" });
    await settle();

    expect(document.querySelector('[data-slot="select-item"][data-active]')?.textContent).toBe("Fig");
  });

  test("Enter commits the active option", async () => {
    let chosen: string | undefined;
    const { container } = render(() => <Fruit onValueChange={(v) => (chosen = v)} />);

    await fireEvent.keyDown(container.querySelector("button")!, { key: "ArrowDown" });
    await settle();
    await fireEvent.keyDown(slot("select-content")!, { key: "ArrowDown" });
    await fireEvent.keyDown(slot("select-content")!, { key: "Enter" });
    await settle();

    expect(chosen).toBe("pear");
  });

  test("Escape closes the panel", async () => {
    const { container } = render(() => <Fruit />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    await fireEvent.keyDown(slot("select-content")!, { key: "Escape" });
    await settle();

    expect(slot("select-content")).toBeNull();
  });

  test("a press outside dismisses it", async () => {
    const { container } = render(() => <Fruit />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    await fireEvent.pointerDown(document.body);
    await settle();

    expect(slot("select-content")).toBeNull();
  });

  test("the page behind stays scrollable — it is not modal", async () => {
    const { container } = render(() => <Fruit />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

const Actions = (props: { onPick: () => void; onToggle?: () => void }) => (
  <DropdownMenu>
    <DropdownMenuTrigger>Options</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuLabel>Account</DropdownMenuLabel>
      <DropdownMenuItem onSelect={props.onPick}>Profile</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked={false} onSelect={props.onToggle}>
        Show status
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

describe("DropdownMenu", () => {
  test("the trigger is a menu button, closed until opened", () => {
    const { container } = render(() => <Actions onPick={() => {}} />);
    const trigger = container.querySelector("button")!;

    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(slot("dropdown-menu-content")).toBeNull();
  });

  test("opens on click with menu semantics", async () => {
    const { container } = render(() => <Actions onPick={() => {}} />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    expect(slot("dropdown-menu-content")?.getAttribute("role")).toBe("menu");
    expect(slot("dropdown-menu-item")?.getAttribute("role")).toBe("menuitem");
  });

  test("choosing an item runs it and closes the menu", async () => {
    let picked = false;
    const { container } = render(() => <Actions onPick={() => (picked = true)} />);

    await fireEvent.click(container.querySelector("button")!);
    await settle();
    await fireEvent.click(slot("dropdown-menu-item")!);
    await settle();

    expect(picked).toBe(true);
    expect(slot("dropdown-menu-content")).toBeNull();
  });

  test("Escape closes it and returns focus to the trigger", async () => {
    const { container } = render(() => <Actions onPick={() => {}} />);
    const trigger = container.querySelector<HTMLElement>("button")!;

    await fireEvent.click(trigger);
    await settle();
    await fireEvent.keyDown(slot("dropdown-menu-content")!, { key: "Escape" });
    await settle();

    expect(slot("dropdown-menu-content")).toBeNull();
    // Dropped at the top of the page otherwise, which is disorienting after
    // opening a menu by accident.
    expect(document.activeElement).toBe(trigger);
  });

  test("one tab stop, arrows move between items", async () => {
    const { container } = render(() => <Actions onPick={() => {}} />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    const items = document.querySelectorAll<HTMLElement>('[data-roving-item]');
    const stops = [...items].filter((item) => item.getAttribute("tabindex") === "0");

    expect(stops.length).toBe(1);

    stops[0]!.focus();
    expect(document.activeElement?.textContent).toContain("Profile");

    await fireEvent.keyDown(slot("dropdown-menu-items")!, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Show status");
  });

  test("a checkbox item keeps the menu open, since it may be toggled again", async () => {
    let toggles = 0;
    const { container } = render(() => <Actions onPick={() => {}} onToggle={() => (toggles += 1)} />);

    await fireEvent.click(container.querySelector("button")!);
    await settle();
    await fireEvent.click(slot("dropdown-menu-checkbox-item")!);
    await settle();

    expect(toggles).toBe(1);
    expect(slot("dropdown-menu-content")).not.toBeNull();
  });

  test("a checkbox item reports its state as a menuitemcheckbox", async () => {
    const { container } = render(() => <Actions onPick={() => {}} />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    const item = slot("dropdown-menu-checkbox-item")!;
    expect(item.getAttribute("role")).toBe("menuitemcheckbox");
    expect(item.getAttribute("aria-checked")).toBe("false");
  });

  test("asChild keeps the caller's element as the trigger", async () => {
    const { container } = render(() => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <a href="/menu">Menu</a>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ));

    const trigger = container.querySelector("a")!;
    expect(trigger.getAttribute("data-slot")).toBe("dropdown-menu-trigger");

    await fireEvent.click(trigger);
    await settle();

    expect(slot("dropdown-menu-content")).not.toBeNull();
  });

  test("the page behind stays scrollable", async () => {
    const { container } = render(() => <Actions onPick={() => {}} />);
    await fireEvent.click(container.querySelector("button")!);
    await settle();

    expect(document.body.style.overflow).not.toBe("hidden");
  });
});