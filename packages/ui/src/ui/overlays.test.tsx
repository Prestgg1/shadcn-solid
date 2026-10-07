import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "./drawer";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { HoverCard, HoverCardContent, HoverCardTitle, HoverCardTrigger } from "./hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

/** The panel is portalled, so it is not inside `container`. */
const panel = (slot: string) => document.querySelector<HTMLElement>(`[data-slot="${slot}"]`);

/**
 * Wait for the exit animation to finish.
 *
 * `presence.ts` deliberately unmounts a frame *after* the closing state
 * reaches the DOM, because a transition can only be observed once the class
 * is on the element. So "closed" is not observable synchronously — a test
 * that asserts immediately would pass only by accident. Effects are
 * microtask-batched on top of that, so both are drained here.
 */
const settle = async () => {
  for (let i = 0; i < 3; i += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.resolve();
  }
};

/** Wait out a hover card's open/close delay plus one frame. */
const afterDelay = async (ms: number) => {
  await Bun.sleep(ms);
  await settle();
};

describe("Dialog", () => {
  test("renders nothing until it is opened", () => {
    render(() => (
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    expect(panel("dialog-content")).toBeNull();
  });

  test("names the dialog from its title and describes it from its description", async () => {
    render(() => (
      <Dialog defaultOpen>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Saves immediately.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    ));

    const content = panel("dialog-content")!;
    const title = panel("dialog-title")!;
    const description = panel("dialog-description")!;

    expect(content.getAttribute("role")).toBe("dialog");
    expect(content.getAttribute("aria-modal")).toBe("true");
    // The accessible name comes from the visible text, not a duplicated
    // aria-label.
    expect(content.getAttribute("aria-labelledby")).toBe(title.id);
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
  });

  test("opens from the trigger and closes from DialogClose", async () => {
    const { getByText } = render(() => (
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogClose>Done</DialogClose>
        </DialogContent>
      </Dialog>
    ));

    await fireEvent.click(getByText("Open"));
    await settle();
    expect(panel("dialog-content")).not.toBeNull();

    await fireEvent.click(document.querySelector('[data-slot="dialog-close"]')!);
    await settle();
    expect(panel("dialog-content")).toBeNull();
  });

  test("reports open state through the trigger", async () => {
    const { getByText } = render(() => (
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    const trigger = getByText("Open");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(trigger);
    expect(getByText("Open").getAttribute("aria-expanded")).toBe("true");
  });

  test("Escape closes it", async () => {
    render(() => (
      <Dialog defaultOpen>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    expect(panel("dialog-content")).not.toBeNull();

    await fireEvent.keyDown(document, { key: "Escape" });
    await settle();
    expect(panel("dialog-content")).toBeNull();
  });

  test("a press outside the panel closes it", async () => {
    render(() => (
      <Dialog defaultOpen>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    await fireEvent.pointerDown(document.body);
    await settle();
    expect(panel("dialog-content")).toBeNull();
  });

  test("a press inside the panel does not close it", async () => {
    render(() => (
      <Dialog defaultOpen>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    await fireEvent.pointerDown(panel("dialog-content")!);
    expect(panel("dialog-content")).not.toBeNull();
  });

  test("locks the page behind while open", async () => {
    render(() => (
      <Dialog defaultOpen>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    expect(document.body.style.overflow).toBe("hidden");
  });

  test("focuses the panel rather than its close button", async () => {
    render(() => (
      <Dialog defaultOpen>
        <DialogContent>
          <DialogClose>Done</DialogClose>
        </DialogContent>
      </Dialog>
    ));
    await settle();

    // Focusing "Done" first would put a destructive-looking button under the
    // user's finger in a dialog that may not even be destructive.
    expect(document.activeElement).toBe(panel("dialog-content"));
  });

  test("asChild puts the trigger behaviour on the caller's element", async () => {
    const { getByText } = render(() => (
      <Dialog>
        <DialogTrigger asChild>
          <a href="/edit">Edit</a>
        </DialogTrigger>
        <DialogContent>Body</DialogContent>
      </Dialog>
    ));

    const trigger = getByText("Edit");
    expect(trigger.tagName).toBe("A");
    expect(trigger.getAttribute("data-slot")).toBe("dialog-trigger");

    await fireEvent.click(trigger);
    expect(panel("dialog-content")).not.toBeNull();
  });
});

describe("AlertDialog", () => {
  test("is an alertdialog, not a plain dialog", () => {
    render(() => (
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete?</AlertDialogTitle>
            <AlertDialogDescription>Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    ));

    expect(panel("alert-dialog-content")?.getAttribute("role")).toBe("alertdialog");
  });

  test("focuses Cancel, so the safe choice is the resting state", async () => {
    render(() => (
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    ));
    await settle();

    expect(document.activeElement?.getAttribute("data-slot")).toBe("alert-dialog-cancel");
  });

  test("Action closes it", async () => {
    render(() => (
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    ));
    await settle();

    await fireEvent.click(panel("alert-dialog-action")!);
    await settle();
    expect(panel("alert-dialog-content")).toBeNull();
  });

  test("Cancel closes it without confirming", async () => {
    render(() => (
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    ));
    await settle();

    await fireEvent.click(panel("alert-dialog-cancel")!);
    await settle();
    expect(panel("alert-dialog-content")).toBeNull();
  });
});

describe("Sheet", () => {
  test("renders on the requested side and exposes it as data-side", () => {
    render(() => (
      <Sheet defaultOpen>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Account.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    ));

    const content = panel("sheet-content")!;
    expect(content.getAttribute("data-side")).toBe("left");
    expect(content.className).toContain("left-0");
    expect(content.getAttribute("role")).toBe("dialog");
  });

  test("defaults to the right edge", () => {
    render(() => (
      <Sheet defaultOpen>
        <SheetContent>Body</SheetContent>
      </Sheet>
    ));

    expect(panel("sheet-content")?.getAttribute("data-side")).toBe("right");
  });

  test("opens from its trigger", async () => {
    const { getByText } = render(() => (
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>Body</SheetContent>
      </Sheet>
    ));

    await fireEvent.click(getByText("Open"));
    expect(panel("sheet-content")).not.toBeNull();
  });
});

describe("Drawer", () => {
  test("springs up from the bottom and ships a decorative grip", () => {
    render(() => (
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerTitle>Menu</DrawerTitle>
        </DrawerContent>
      </Drawer>
    ));

    expect(panel("drawer-content")?.getAttribute("data-side")).toBe("bottom");
    expect(panel("drawer-handle")).not.toBeNull();
  });

  test("opens from its trigger", async () => {
    const { getByText } = render(() => (
      <Drawer>
        <DrawerTrigger>Menu</DrawerTrigger>
        <DrawerContent>Body</DrawerContent>
      </Drawer>
    ));

    await fireEvent.click(getByText("Menu"));
    expect(panel("drawer-content")).not.toBeNull();
  });
});

describe("Popover", () => {
  test("is non-modal: the page behind stays scrollable", () => {
    render(() => (
      <Popover defaultOpen>
        <PopoverTrigger>Options</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));

    expect(panel("popover-content")).not.toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  test("toggles from its trigger", async () => {
    const { getByText } = render(() => (
      <Popover>
        <PopoverTrigger>Options</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));

    await fireEvent.click(getByText("Options"));
    await settle();
    expect(panel("popover-content")).not.toBeNull();

    await fireEvent.click(getByText("Options"));
    await settle();
    expect(panel("popover-content")).toBeNull();
  });

  test("a press on the trigger does not dismiss and reopen", async () => {
    const { getByText } = render(() => (
      <Popover>
        <PopoverTrigger>Options</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));

    await fireEvent.click(getByText("Options"));
    expect(panel("popover-content")).not.toBeNull();

    await fireEvent.pointerDown(getByText("Options"));
    expect(panel("popover-content")).not.toBeNull();
  });

  test("a press outside closes it", async () => {
    const { getByText } = render(() => (
      <Popover>
        <PopoverTrigger>Options</PopoverTrigger>
        <PopoverContent>Body</PopoverContent>
      </Popover>
    ));

    await fireEvent.click(getByText("Options"));
    await fireEvent.pointerDown(document.body);
    await settle();

    expect(panel("popover-content")).toBeNull();
  });
});

describe("HoverCard", () => {
  test("waits out the open delay instead of flashing on the way past", async () => {
    const { getByText } = render(() => (
      <HoverCard openDelay={50}>
        <HoverCardTrigger href="/p">Read</HoverCardTrigger>
        <HoverCardContent>
          <HoverCardTitle>Post</HoverCardTitle>
        </HoverCardContent>
      </HoverCard>
    ));

    await fireEvent.pointerEnter(getByText("Read"));
    expect(panel("hover-card-content")).toBeNull();

    await afterDelay(80);
    expect(panel("hover-card-content")).not.toBeNull();
  });

  test("stays open while the pointer is over the card", async () => {
    const { getByText } = render(() => (
      <HoverCard openDelay={10} closeDelay={10}>
        <HoverCardTrigger href="/p">Read</HoverCardTrigger>
        <HoverCardContent>
          <HoverCardTitle>Post</HoverCardTitle>
        </HoverCardContent>
      </HoverCard>
    ));

    await fireEvent.pointerEnter(getByText("Read"));
    await afterDelay(40);
    expect(panel("hover-card-content")).not.toBeNull();

    await fireEvent.pointerLeave(getByText("Read"));
    await fireEvent.pointerEnter(panel("hover-card-content")!);
    await afterDelay(40);

    expect(panel("hover-card-content")).not.toBeNull();
  });

  test("closes after the close delay once the pointer leaves everywhere", async () => {
    const { getByText } = render(() => (
      <HoverCard openDelay={10} closeDelay={20}>
        <HoverCardTrigger href="/p">Read</HoverCardTrigger>
        <HoverCardContent>
          <HoverCardTitle>Post</HoverCardTitle>
        </HoverCardContent>
      </HoverCard>
    ));

    await fireEvent.pointerEnter(getByText("Read"));
    await afterDelay(40);
    expect(panel("hover-card-content")).not.toBeNull();

    await fireEvent.pointerLeave(getByText("Read"));
    await afterDelay(60);
    expect(panel("hover-card-content")).toBeNull();
  });

  test("opens on focus, so it is reachable by keyboard", async () => {
    const { getByText } = render(() => (
      <HoverCard openDelay={0}>
        <HoverCardTrigger href="/p">Read</HoverCardTrigger>
        <HoverCardContent>
          <HoverCardTitle>Post</HoverCardTitle>
        </HoverCardContent>
      </HoverCard>
    ));

    await fireEvent.focus(getByText("Read"));
    await afterDelay(20);
    expect(panel("hover-card-content")).not.toBeNull();
  });
});

describe("Tooltip", () => {
  test("opens immediately on hover — it is the missing label", async () => {
    const { getByText } = render(() => (
      <Tooltip>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>
    ));

    await fireEvent.pointerEnter(getByText("Save"));
    expect(panel("tooltip-content")).not.toBeNull();
  });

  test("describes its trigger rather than labelling it", async () => {
    const { getByText } = render(() => (
      <Tooltip>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>
    ));

    await fireEvent.pointerEnter(getByText("Save"));

    expect(panel("tooltip-content")?.getAttribute("role")).toBe("tooltip");
    expect(getByText("Save").getAttribute("aria-describedby")).toBe(panel("tooltip-content")!.id);
  });

  test("opens on focus and closes on Escape", async () => {
    const { getByText } = render(() => (
      <Tooltip>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>
    ));

    await fireEvent.focus(getByText("Save"));
    expect(panel("tooltip-content")).not.toBeNull();

    await fireEvent.keyDown(getByText("Save"), { key: "Escape" });
    await settle();
    expect(panel("tooltip-content")).toBeNull();
  });

  test("closes when the pointer leaves", async () => {
    const { getByText } = render(() => (
      <Tooltip>
        <TooltipTrigger>Save</TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>
    ));

    await fireEvent.pointerEnter(getByText("Save"));
    await fireEvent.pointerLeave(getByText("Save"));
    await settle();

    expect(panel("tooltip-content")).toBeNull();
  });

  test("TooltipProvider forwards its children", () => {
    const { getByText } = render(() => (
      <TooltipProvider>
        <span>child</span>
      </TooltipProvider>
    ));

    expect(getByText("child")).toBeDefined();
  });

  test("asChild keeps the caller's element as the anchor", async () => {
    const { getByText } = render(() => (
      <Tooltip>
        <TooltipTrigger asChild>
          <a href="/save">Save</a>
        </TooltipTrigger>
        <TooltipContent>Save changes</TooltipContent>
      </Tooltip>
    ));

    const trigger = getByText("Save");
    expect(trigger.tagName).toBe("A");

    await fireEvent.pointerEnter(trigger);
    expect(panel("tooltip-content")).not.toBeNull();
  });
});
