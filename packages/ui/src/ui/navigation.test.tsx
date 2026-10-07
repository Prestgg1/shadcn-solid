import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import { Toaster, toast } from "./sonner";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

const toasts = () => document.querySelectorAll<HTMLElement>('[data-slot="toast"]');

/**
 * Solid batches signal writes onto a microtask, so anything pushed outside an
 * event handler needs a tick before it is in the DOM.
 */
const tick = () => Promise.resolve();

/** The queue is module-level, so each test starts from a known state. */
function resetToasts() {
  toast.dismissAll();
}

describe("toast", () => {
  test("renders nothing until something is pushed", async () => {
    resetToasts();
    render(() => <Toaster />);
    expect(toasts().length).toBe(0);
  });

  test("shows a message from anywhere", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("Saved");
    await tick();
    expect(toasts().length).toBe(1);
    expect(toasts()[0]!.textContent).toContain("Saved");
  });

  test("stacks several messages", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("First");
    await tick();
    toast("Second");
    await tick();
    toast("Third");
    await tick();

    expect(toasts().length).toBe(3);
  });

  test("repeats a message into a count rather than a second card", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("Saved");
    await tick();
    toast("Saved");
    await tick();
    toast("Saved");
    await tick();

    // Three identical cards fight for attention; one with a count reads as
    // "that happened three times", which is the actual information.
    expect(toasts().length).toBe(1);
    expect(slot("toast-count")?.textContent).toBe("(3)");
  });

  test("stacks different messages separately", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("Saved");
    await tick();
    toast("Published");
    await tick();

    expect(toasts().length).toBe(2);
  });

  test("carries a description", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("Saved", { description: "Just now" });
    await tick();
    expect(toasts()[0]!.textContent).toContain("Just now");
  });

  test("carries its variant through to the DOM", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast.success("Done");
    await tick();
    toast.error("Failed");
    await tick();

    expect(toasts()[0]!.getAttribute("data-variant")).toBe("success");
    expect(toasts()[1]!.getAttribute("data-variant")).toBe("error");
  });

  test("an error is announced as an alert", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("Saved");
    await tick();
    toast.error("Failed");
    await tick();

    expect(toasts()[0]!.getAttribute("role")).toBe("status");
    expect(toasts()[1]!.getAttribute("role")).toBe("alert");
  });

  test("the stack is polite so it does not interrupt", async () => {
    resetToasts();
    render(() => <Toaster />);

    // `assertive` would cut across whatever the user is doing to announce a
    // background save.
    expect(slot("toaster")?.getAttribute("aria-live")).toBe("polite");
  });

  test("the close button dismisses one toast", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("First");
    await tick();
    toast("Second");
    await tick();

    await fireEvent.click(toasts()[0]!.querySelector('[data-slot="toast-close"]')!);
    await tick();

    expect(toasts().length).toBe(1);
    expect(toasts()[0]!.textContent).toContain("Second");
  });

  test("the handle dismisses its own toast", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("First");
    await tick();
    const second = toast("Second");

    second.dismiss();
    await tick();
    expect(toasts().length).toBe(1);

    toast.dismissAll();
    await tick();
  });

  test("update replaces the message in place", async () => {
    resetToasts();
    render(() => <Toaster />);

    const current = toast("Saving…");
    toast("Something else");
    await tick();
    await tick();

    current.update("Saved");
    await tick();

    // A new card for every progress step would push the stack down the screen.
    expect(toasts().length).toBe(2);
    expect(toasts()[0]!.textContent).toContain("Saved");
  });

  test("an action runs and dismisses the toast", async () => {
    resetToasts();
    render(() => <Toaster />);

    let undone = false;
    toast("Deleted", { action: { label: "Undo", onClick: () => (undone = true) } });
    await tick();
    await tick();

    await fireEvent.click(slot("toast-action")!);

    expect(undone).toBe(true);
    expect(toasts().length).toBe(0);
  });

  test("toast.promise shows one loading toast, then the outcome", async () => {
    resetToasts();
    render(() => <Toaster />);

    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });

    toast.promise(promise, { loading: "Saving…", success: "Saved", error: "Failed" });
    await tick();
    expect(toasts().length).toBe(1);
    expect(toasts()[0]!.textContent).toContain("Saving…");

    resolve();
    await Bun.sleep(5);

    // One toast that changes, not two stacked.
    expect(toasts().length).toBe(1);
    expect(toasts()[0]!.textContent).toContain("Saved");
  });

  test("a rejected promise reports the failure and clears the spinner", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast.promise(Promise.reject(new Error("boom")), {
      loading: "Saving…",
      success: "Saved",
      error: (reason) => (reason instanceof Error ? reason.message : String(reason)),
    });

    await Bun.sleep(5);

    expect(toasts().length).toBe(1);
    expect(toasts()[0]!.getAttribute("data-variant")).toBe("error");
    expect(toasts()[0]!.textContent).toContain("boom");
  });

  test("hides the close button when asked", async () => {
    resetToasts();
    render(() => <Toaster />);

    toast("Busy", { closeButton: false });
    await tick();
    expect(slot("toast-close")).toBeNull();
  });
});

const Nav = (props: { onHoverDelay?: number }) => (
  <NavigationMenu delayDuration={props.onHoverDelay ?? 0}>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Products</NavigationMenuTrigger>
        <NavigationMenuContent>
          <NavigationMenuLink href="/analytics">Analytics</NavigationMenuLink>
          <NavigationMenuLink href="/reports" active>
            Reports
          </NavigationMenuLink>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem>
        <NavigationMenuLink href="/docs">Docs</NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);

describe("NavigationMenu", () => {
  test("the bar is a nav with a list of items", async () => {
    const { container } = render(() => <Nav />);

    expect(container.querySelector("nav")).not.toBeNull();
    expect(slot("navigation-menu-list")?.tagName).toBe("UL");
  });

  test("a trigger reports whether its panel is open", async () => {
    const { container } = render(() => <Nav />);

    expect(container.querySelector('[data-slot="navigation-menu-trigger"]')?.getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  test("opens the panel on click and closes it on Escape", async () => {
    const { container } = render(() => <Nav />);
    const trigger = container.querySelector<HTMLElement>('[data-slot="navigation-menu-trigger"]')!;

    await fireEvent.click(trigger);
    await Bun.sleep(5);
    expect(slot("navigation-menu-content")).not.toBeNull();

    await fireEvent.keyDown(container.querySelector("nav")!, { key: "Escape" });
    await Bun.sleep(5);

    expect(slot("navigation-menu-content")).toBeNull();
    // Back on the trigger, rather than at the top of the document.
    expect(document.activeElement).toBe(trigger);
  });

  test("the panel holds real links", async () => {
    const { container } = render(() => <Nav />);

    await fireEvent.click(container.querySelector('[data-slot="navigation-menu-trigger"]')!);
    await Bun.sleep(5);

    // Scoped to the panel: the bar itself carries a plain link for Docs.
    const links = slot("navigation-menu-content")!.querySelectorAll<HTMLAnchorElement>(
      '[data-slot="navigation-menu-link"]',
    );
    expect(links.length).toBe(2);
    expect(links[0]!.getAttribute("href")).toBe("/analytics");
    expect(links[0]!.tagName).toBe("A");
  });

  test("marks the current page's link", async () => {
    const { container } = render(() => <Nav />);

    await fireEvent.click(container.querySelector('[data-slot="navigation-menu-trigger"]')!);
    await Bun.sleep(5);

    const active = document.querySelector('[data-slot="navigation-menu-link"][data-active]')!;
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.textContent).toContain("Reports");
  });

  test("choosing a link closes the panel", async () => {
    const { container } = render(() => <Nav />);

    await fireEvent.click(container.querySelector('[data-slot="navigation-menu-trigger"]')!);
    await Bun.sleep(5);
    await fireEvent.click(document.querySelector('[data-slot="navigation-menu-link"]')!);
    await Bun.sleep(5);

    expect(slot("navigation-menu-content")).toBeNull();
  });

  test("a controlled open state is not overridden by Escape", async () => {
    // No `onOpenChange`, so the host never changes its mind: the menu must
    // not close itself either. A controlled component that quietly does its
    // own thing is the worst kind of controlled component.
    const { container } = render(() => (
      <NavigationMenu open>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Products</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/analytics">Analytics</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    ));

    await Bun.sleep(5);
    expect(slot("navigation-menu-content")).not.toBeNull();

    await fireEvent.keyDown(container.querySelector("nav")!, { key: "Escape" });
    await Bun.sleep(5);

    expect(slot("navigation-menu-content")).not.toBeNull();
  });

  test("an uncontrolled menu closes itself on Escape", async () => {
    const { container } = render(() => <Nav />);

    await fireEvent.click(container.querySelector('[data-slot="navigation-menu-trigger"]')!);
    await Bun.sleep(5);
    expect(slot("navigation-menu-content")).not.toBeNull();

    await fireEvent.keyDown(container.querySelector("nav")!, { key: "Escape" });
    await Bun.sleep(5);

    expect(slot("navigation-menu-content")).toBeNull();
  });
});

