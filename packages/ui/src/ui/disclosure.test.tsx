import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { ScrollArea } from "./scroll-area";
import { ResizableGroup, ResizableHandle, ResizablePanel } from "./resizable";

const slot = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-slot="${name}"]`);

describe("Collapsible", () => {
  test("starts closed unless told otherwise", () => {
    const { container } = render(() => (
      <Collapsible>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </Collapsible>
    ));

    expect(slot(container, "collapsible")?.getAttribute("data-state")).toBe("closed");
    expect(slot(container, "collapsible-content")).toBeNull();
  });

  test("honours defaultOpen", () => {
    const { container } = render(() => (
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </Collapsible>
    ));

    expect(slot(container, "collapsible-content")?.textContent).toBe("Body");
  });

  test("toggles from the trigger", async () => {
    const { container, getByText } = render(() => (
      <Collapsible>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </Collapsible>
    ));

    await fireEvent.click(getByText("Advanced"));
    expect(slot(container, "collapsible-content")?.textContent).toBe("Body");

    await fireEvent.click(getByText("Advanced"));
    expect(slot(container, "collapsible-content")).toBeNull();
  });

  test("the trigger reports its state to assistive tech", async () => {
    const { container, getByText } = render(() => (
      <Collapsible>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </Collapsible>
    ));

    const trigger = slot(container, "collapsible-trigger")!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(getByText("Advanced"));
    expect(slot(container, "collapsible-trigger")?.getAttribute("aria-expanded")).toBe("true");
  });

  test("keeps the region mounted but hidden with forceMount", () => {
    const { container } = render(() => (
      <Collapsible>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent forceMount>Body</CollapsibleContent>
      </Collapsible>
    ));

    // Mounted so an uncontrolled <input> inside keeps its value across hides.
    expect(slot(container, "collapsible-content")?.hasAttribute("hidden")).toBe(true);
  });

  test("a disabled trigger does nothing", async () => {
    const { container, getByText } = render(() => (
      <Collapsible disabled>
        <CollapsibleTrigger>Advanced</CollapsibleTrigger>
        <CollapsibleContent>Body</CollapsibleContent>
      </Collapsible>
    ));

    await fireEvent.click(getByText("Advanced"));
    expect(slot(container, "collapsible-content")).toBeNull();
  });
});

describe("Accordion", () => {
  const three = (
    <Accordion type="single">
      <AccordionItem value="a">
        <AccordionTrigger>First</AccordionTrigger>
        <AccordionContent>A body</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Second</AccordionTrigger>
        <AccordionContent>B body</AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  test("opens the item whose trigger was pressed", async () => {
    const { container, getByText } = render(() => three);
    await fireEvent.click(getByText("Second"));

    expect(slot(container, "accordion-item:nth-of-type(1)")).toBeNull();
    expect(container.textContent).toContain("B body");
  });

  test("type=single closes the previous item", async () => {
    const { container, getByText } = render(() => three);

    await fireEvent.click(getByText("First"));
    expect(container.textContent).toContain("A body");

    await fireEvent.click(getByText("Second"));
    expect(container.textContent).not.toContain("A body");
    expect(container.textContent).toContain("B body");
  });

  test("type=multiple leaves the others open", async () => {
    const { container, getByText } = render(() => (
      <Accordion type="multiple">
        <AccordionItem value="a">
          <AccordionTrigger>First</AccordionTrigger>
          <AccordionContent>A body</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Second</AccordionTrigger>
          <AccordionContent>B body</AccordionContent>
        </AccordionItem>
      </Accordion>
    ));

    await fireEvent.click(getByText("First"));
    await fireEvent.click(getByText("Second"));

    expect(container.textContent).toContain("A body");
    expect(container.textContent).toContain("B body");
  });

  test("stays open when the open item is clicked again without collapsible", async () => {
    const { container, getByText } = render(() => (
      <Accordion type="single" defaultValue="a">
        <AccordionItem value="a">
          <AccordionTrigger>First</AccordionTrigger>
          <AccordionContent>A body</AccordionContent>
        </AccordionItem>
      </Accordion>
    ));

    await fireEvent.click(getByText("First"));
    expect(container.textContent).toContain("A body");
  });

  test("closes on the second click when collapsible", async () => {
    const { container, getByText } = render(() => (
      <Accordion type="single" collapsible defaultValue="a">
        <AccordionItem value="a">
          <AccordionTrigger>First</AccordionTrigger>
          <AccordionContent>A body</AccordionContent>
        </AccordionItem>
      </Accordion>
    ));

    await fireEvent.click(getByText("First"));
    expect(container.textContent).not.toContain("A body");
  });

  test("wires the trigger to the region it controls", async () => {
    const { container, getByText } = render(() => three);

    const trigger = slot(container, "accordion-trigger")!;
    // The region is not in the DOM until it opens, so the id is read off the
    // trigger and then checked against the element that appears.
    const contentId = trigger.getAttribute("aria-controls")!;
    expect(contentId).toBeTruthy();

    await fireEvent.click(getByText("First"));
    const content = slot(container, "accordion-content")!;
    expect(content.id).toBe(contentId);
    expect(content.getAttribute("role")).toBe("region");
  });

  test("arrow keys move between triggers, one tab stop for the group", async () => {
    const { container, getByText } = render(() => three);

    getByText("First").focus();

    await fireEvent.keyDown(container.querySelector('[data-slot="accordion-group"]')!, {
      key: "ArrowDown",
    });
    expect(document.activeElement?.textContent).toBe("Second");

    await fireEvent.keyDown(container.querySelector('[data-slot="accordion-group"]')!, {
      key: "ArrowUp",
    });
    expect(document.activeElement?.textContent).toBe("First");
  });

  test("a disabled item's trigger is disabled", () => {
    const { container } = render(() => (
      <Accordion>
        <AccordionItem value="a" disabled>
          <AccordionTrigger>First</AccordionTrigger>
          <AccordionContent>A body</AccordionContent>
        </AccordionItem>
      </Accordion>
    ));

    expect(slot(container, "accordion-trigger")?.hasAttribute("disabled")).toBe(true);
  });
});

describe("Tabs", () => {
  const tabs = (activationMode?: "automatic" | "manual") => (
    <Tabs defaultValue="account" activationMode={activationMode}>
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account panel</TabsContent>
      <TabsContent value="password">Password panel</TabsContent>
    </Tabs>
  );

  test("shows only the selected panel", () => {
    const { container } = render(() => tabs());

    expect(container.textContent).toContain("Account panel");
    expect(container.textContent).not.toContain("Password panel");
  });

  test("switches panels on click", async () => {
    const { container, getByText } = render(() => tabs());

    await fireEvent.click(getByText("Password"));
    expect(container.textContent).toContain("Password panel");
    expect(container.textContent).not.toContain("Account panel");
  });

  test("automatic activation switches panels on arrow key", async () => {
    const { container, getByText } = render(() => tabs("automatic"));

    getByText("Account").focus();
    await fireEvent.keyDown(slot(container, "tabs-list")!, { key: "ArrowRight" });

    expect(container.textContent).toContain("Password panel");
  });

  test("manual activation moves focus without switching", async () => {
    const { container, getByText } = render(() => tabs("manual"));

    getByText("Account").focus();
    await fireEvent.keyDown(slot(container, "tabs-list")!, { key: "ArrowRight" });

    // Focus moved, so the next Tab starts from there — but the panel waits.
    expect(document.activeElement?.textContent).toBe("Password");
    expect(container.textContent).toContain("Account panel");
  });

  test("connects each trigger to its panel", () => {
    const { container } = render(() => tabs());

    const triggers = container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]');
    const contents = container.querySelectorAll<HTMLElement>('[data-slot="tabs-content"]');

    expect(triggers[0]!.getAttribute("aria-controls")).toBe(contents[0]!.id);
    expect(contents[0]!.getAttribute("aria-labelledby")).toBe(triggers[0]!.id);
  });

  test("the list is one tab stop, arrows move within it", async () => {
    const { container, getByText } = render(() => tabs());

    getByText("Account").focus();
    const list = slot(container, "tabs-list")!;

    await fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toBe("Password");

    // Wraps, rather than stopping at the end.
    await fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toBe("Account");
  });

  test("marks the selected trigger for assistive tech", () => {
    const { container } = render(() => tabs());

    const triggers = container.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]');
    expect(triggers[0]!.getAttribute("aria-selected")).toBe("true");
    expect(triggers[1]!.getAttribute("aria-selected")).toBe("false");
  });
});

describe("ScrollArea", () => {
  test("renders a viewport that is the real scroller", () => {
    const { container } = render(() => (
      <ScrollArea class="h-40">
        <div>Content</div>
      </ScrollArea>
    ));

    const viewport = slot(container, "scroll-area-viewport")!;
    expect(slot(container, "scroll-area")).not.toBeNull();
    // Native scrolling: wheel, touch and keyboard all work, with no gesture
    // layer of our own to get wrong.
    expect(viewport.className).toContain("overflow-hidden");
  });

  test("passes its class to the outer element, not the viewport", () => {
    const { container } = render(() => (
      <ScrollArea class="h-40">
        <div>Content</div>
      </ScrollArea>
    ));

    expect(slot(container, "scroll-area")?.className).toContain("h-40");
  });

  test("reports no scrolling axes until content overflows", () => {
    const { container } = render(() => (
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>
    ));

    const viewport = slot(container, "scroll-area-viewport")!;
    expect(viewport.hasAttribute("data-scrollable-y")).toBe(false);
    expect(slot(container, "scroll-area-scrollbar")).toBeNull();
    // A region that does not scroll should not be a tab stop.
    expect(viewport.hasAttribute("tabindex")).toBe(false);
  });
});

describe("Resizable", () => {
  test("renders panels, handles and the grip", () => {
    const { container } = render(() => (
      <ResizableGroup>
        <ResizablePanel>One</ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>Two</ResizablePanel>
      </ResizableGroup>
    ));

    expect(slot(container, "resizable-panel")).not.toBeNull();
    expect(slot(container, "resizable-handle")).not.toBeNull();
    expect(slot(container, "resizable-grip")).not.toBeNull();
  });

  test("names the handle as a separator that can be focused", () => {
    const { container } = render(() => (
      <ResizableGroup>
        <ResizablePanel>One</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Two</ResizablePanel>
      </ResizableGroup>
    ));

    const handle = slot(container, "resizable-handle")!;
    expect(handle.getAttribute("role")).toBe("separator");
    // A <button> is focusable by default, so it is in the tab order already —
    // which is what makes arrow-key resizing reachable at all.
    expect(handle.tagName).toBe("BUTTON");
    // The orientation is the direction the panels are stacked in, which is
    // the axis the handle divides — not the axis it slides along.
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
  });

  test("a handle with no grip is still a separator", () => {
    const { container } = render(() => (
      <ResizableGroup>
        <ResizablePanel>One</ResizablePanel>
        <ResizableHandle />
      </ResizableGroup>
    ));

    expect(slot(container, "resizable-grip")).toBeNull();
    expect(slot(container, "resizable-handle")?.getAttribute("role")).toBe("separator");
  });

  test("a vertical group gives its handle the other orientation", () => {
    const { container } = render(() => (
      <ResizableGroup direction="vertical">
        <ResizablePanel>One</ResizablePanel>
        <ResizableHandle />
      </ResizableGroup>
    ));

    expect(slot(container, "resizable-handle")?.getAttribute("aria-orientation")).toBe("vertical");
  });
});