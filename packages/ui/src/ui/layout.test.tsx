import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "./menubar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

const settle = async () => {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.resolve();
  }
};

const Bar = (props: { onPick: () => void; onTick?: () => void }) => (
  <Menubar>
    <MenubarMenu value="file">
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent>
        <MenubarItem onSelect={props.onPick}>Open</MenubarItem>
        <MenubarCheckboxItem checked={false} onSelect={props.onTick}>
          Show path
        </MenubarCheckboxItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu value="edit">
      <MenubarTrigger>Edit</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>Undo</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  </Menubar>
);

const trigger = (label: string) =>
  Array.from(document.querySelectorAll('[data-slot="menubar-trigger"]')).find(
    (node) => node.textContent === label,
  )!;

describe("Menubar", () => {
  test("the bar is a menubar", () => {
    const { container } = render(() => <Bar onPick={() => {}} />);

    const bar = container.querySelector('[data-slot="menubar"]')!;
    expect(bar.getAttribute("role")).toBe("menubar");
  });

  test("a trigger opens its own menu and reports it", async () => {
    const { container } = render(() => <Bar onPick={() => {}} />);

    expect(trigger("File").getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(trigger("File"));
    await settle();

    expect(trigger("File").getAttribute("aria-expanded")).toBe("true");
    expect(slot("menubar-content")?.getAttribute("role")).toBe("menu");
    void container;
  });

  test("only one menu is open at a time — that is what a menu bar is", async () => {
    render(() => <Bar onPick={() => {}} />);

    await fireEvent.click(trigger("File"));
    await settle();
    expect(document.querySelectorAll('[data-slot="menubar-content"]').length).toBe(1);

    await fireEvent.click(trigger("Edit"));
    await settle();

    // File and Edit are alternatives, not layers.
    expect(trigger("Edit").getAttribute("aria-expanded")).toBe("true");
    expect(trigger("File").getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelectorAll('[data-slot="menubar-content"]').length).toBe(1);
  });

  test("clicking an open trigger closes it", async () => {
    render(() => <Bar onPick={() => {}} />);

    await fireEvent.click(trigger("File"));
    await settle();
    await fireEvent.click(trigger("File"));
    await settle();

    expect(slot("menubar-content")).toBeNull();
  });

  test("choosing an item runs it and closes the bar", async () => {
    let picked = false;
    render(() => <Bar onPick={() => (picked = true)} />);

    await fireEvent.click(trigger("File"));
    await settle();
    await fireEvent.click(slot("menubar-item")!);
    await settle();

    expect(picked).toBe(true);
    expect(slot("menubar-content")).toBeNull();
  });

  test("arrows walk the bar and open the menu they arrive at", async () => {
    const { container } = render(() => <Bar onPick={() => {}} />);
    const bar = container.querySelector('[data-slot="menubar"]')!;

    // With nothing open, the arrows move along the bar rather than inside a
    // panel — the behaviour a row of independent dropdowns cannot have.
    await fireEvent.keyDown(bar, { key: "ArrowRight" });
    await settle();
    expect(trigger("File").getAttribute("aria-expanded")).toBe("true");

    await fireEvent.keyDown(bar, { key: "ArrowRight" });
    await settle();
    expect(trigger("Edit").getAttribute("aria-expanded")).toBe("true");

    await fireEvent.keyDown(bar, { key: "ArrowLeft" });
    await settle();
    expect(trigger("File").getAttribute("aria-expanded")).toBe("true");
  });

  test("arrows walk the items once a menu is open", async () => {
    render(() => <Bar onPick={() => {}} />);

    await fireEvent.click(trigger("File"));
    await settle();

    const content = slot("menubar-content")!;
    await fireEvent.keyDown(content, { key: "ArrowDown" });

    const items = Array.from(content.querySelectorAll<HTMLElement>("[data-roving-item]"));
    // Nothing was highlighted when the menu opened, so the first ArrowDown
    // lands on the first item rather than doing nothing.
    expect(items[0]!.getAttribute("tabindex")).toBe("0");
    expect(items[1]!.getAttribute("tabindex")).toBe("-1");

    await fireEvent.keyDown(content, { key: "ArrowDown" });
    expect(items[0]!.getAttribute("tabindex")).toBe("-1");
    expect(items[1]!.getAttribute("tabindex")).toBe("0");
  });

  test("Escape closes the menu and puts focus back on the bar", async () => {
    render(() => <Bar onPick={() => {}} />);

    await fireEvent.click(trigger("File"));
    await settle();
    await fireEvent.keyDown(slot("menubar-content")!, { key: "Escape" });
    await settle();

    expect(slot("menubar-content")).toBeNull();
    expect(document.activeElement).toBe(trigger("File"));
  });

  test("a checkbox item keeps the bar open", async () => {
    let ticks = 0;
    render(() => <Bar onPick={() => {}} onTick={() => (ticks += 1)} />);

    await fireEvent.click(trigger("File"));
    await settle();
    await fireEvent.click(slot("menubar-checkbox-item")!);
    await settle();

    expect(ticks).toBe(1);
    expect(slot("menubar-content")).not.toBeNull();
  });

  test("hovering another trigger swaps which menu is open", async () => {
    render(() => <Bar onPick={() => {}} />);

    await fireEvent.click(trigger("File"));
    await settle();
    await fireEvent.pointerEnter(trigger("Edit"));
    await settle();

    expect(trigger("Edit").getAttribute("aria-expanded")).toBe("true");
    expect(trigger("File").getAttribute("aria-expanded")).toBe("false");
  });
});

const Layout = (props: { open?: boolean; defaultOpen?: boolean }) => (
  <SidebarProvider defaultOpen={props.defaultOpen ?? true}>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span>Acme</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive label="Overview">
                <span>Overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton label="Reports">Reports</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <span>Signed in</span>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset>
      <SidebarTrigger />
      <main>Content</main>
    </SidebarInset>
  </SidebarProvider>
);

describe("Sidebar", () => {
  test("renders its regions", () => {
    const { container } = render(() => <Layout />);

    for (const name of [
      "sidebar",
      "sidebar-header",
      "sidebar-content",
      "sidebar-footer",
      "sidebar-group",
      "sidebar-menu",
      "sidebar-menu-button",
      "sidebar-inset",
    ]) {
      expect(container.querySelector(`[data-slot="${name}"]`), name).not.toBeNull();
    }
  });

  test("is a complementary landmark named by its label", () => {
    const { container } = render(() => <Layout />);

    const sidebar = container.querySelector('[data-slot="sidebar"]')!;
    expect(sidebar.getAttribute("aria-label")).toBe("Sidebar");
  });

  test("open by default, and says so", () => {
    const { container } = render(() => <Layout />);

    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("expanded");
  });

  test("starts collapsed when asked", () => {
    const { container } = render(() => <Layout defaultOpen={false} />);

    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed");
  });

  test("the trigger toggles it", async () => {
    const { container } = render(() => <Layout />);

    const trigger = container.querySelector<HTMLButtonElement>('[data-slot="sidebar-trigger"]')!;
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await fireEvent.click(trigger);

    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("the trigger is a real button, keyboard-reachable", () => {
    const { container } = render(() => <Layout />);

    const trigger = container.querySelector('[data-slot="sidebar-trigger"]')!;
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-controls")).toBe(
      container.querySelector('[data-slot="sidebar"]')!.id,
    );
  });

  test("collapsing to icons keeps the labels for screen readers", async () => {
    const { container } = render(() => <Layout />);

    await fireEvent.click(container.querySelector('[data-slot="sidebar-trigger"]')!);

    // An icon-only sidebar with no names is a wall of unlabelled glyphs; the
    // label stays in the DOM, hidden visually, for a screen reader.
    const label = container.querySelector('[data-slot="sidebar-menu-label"]')!;
    expect(label.className).toContain("sr-only");
    expect(label.textContent).toBe("Overview");
  });

  test("marks the current item", () => {
    const { container } = render(() => <Layout />);

    const active = container.querySelector('[data-slot="sidebar-menu-button"][data-active]')!;
    expect(active.textContent).toContain("Overview");
    expect(active.getAttribute("data-active")).toBe("");
  });

  test("groups are labelled", () => {
    const { container } = render(() => <Layout />);

    const group = container.querySelector('[data-slot="sidebar-group"]')!;
    expect(group.getAttribute("aria-labelledby")).toBe(
      container.querySelector('[data-slot="sidebar-group-label"]')!.id,
    );
  });

  test("keyboard shortcut toggles it", async () => {
    const { container } = render(() => <Layout />);

    await fireEvent.keyDown(document, { key: "b", ctrlKey: true });
    expect(container.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state")).toBe("collapsed");
  });
});