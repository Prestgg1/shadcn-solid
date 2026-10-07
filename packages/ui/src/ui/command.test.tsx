import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";

import { Button } from "~/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/ui/command";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/ui/combobox";
import { Popover, PopoverTrigger } from "~/ui/popover";

/**
 * A command palette wired the way a real application would, so the tests below
 * exercise the composition rather than each part in isolation.
 */
function Palette(props: {
  onRun: (value: string) => void;
  onEscape?: () => void;
  onQueryChange?: (value: string) => void;
}) {
  return (
    <Command onEscape={props.onEscape} onValueChange={props.onQueryChange}>
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Suggestions">
          <CommandItem value="Open file">
            Open file
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem value="Go to line">Go to line</CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Destructive">
          <CommandItem value="Delete project" onSelect={props.onRun}>
            Delete project
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

const commands = ["Open file", "Go to line", "Delete project"];

/** The DOM is queried by hand here: `<Show>` unmounts filtered-out items. */
const itemTexts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-slot="command-item"]')).map(
    (element) => element.getAttribute("data-value") ?? "",
  );

const activeText = () =>
  document.querySelector('[data-slot="command-item"][data-active]')?.getAttribute("data-value");

const input = () => document.querySelector<HTMLInputElement>('[data-slot="command-input"]')!;
const commandRoot = () => document.querySelector<HTMLElement>('[data-slot="command"]')!;

/** Type into whichever input the current block is about. */
async function typeInto(field: HTMLInputElement, text: string): Promise<void> {
  field.value = text;
  field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await Promise.resolve();
}

describe("Command", () => {
  test("renders every item before anything is typed", () => {
    render(() => <Palette onRun={() => {}} />);
    expect(itemTexts()).toEqual(commands);
  });

  test("filters case-insensitively as you type", async () => {
    render(() => <Palette onRun={() => {}} />);

    await typeInto(input(), "go");
    expect(itemTexts()).toEqual(["Go to line"]);

    await typeInto(input(), "");
    expect(itemTexts()).toEqual(commands);
  });

  test("a partial substring matches, not just a prefix", async () => {
    render(() => <Palette onRun={() => {}} />);
    await typeInto(input(), "file");
    expect(itemTexts()).toEqual(["Open file"]);
  });

  test("shows the empty state when nothing matches", async () => {
    const { container } = render(() => <Palette onRun={() => {}} />);
    await typeInto(input(), "zzzz");

    expect(itemTexts()).toEqual([]);
    // Rendered unconditionally, so the list does not rebuild under the cursor.
    expect(container.querySelector('[data-slot="command-empty"]')).not.toBeNull();
  });

  test("the input is a controlled combobox over the list", () => {
    render(() => <Palette onRun={() => {}} />);

    expect(input().getAttribute("role")).toBe("combobox");
    expect(input().getAttribute("aria-autocomplete")).toBe("list");
    expect(commandRoot().querySelector('[data-slot="command-list"]')?.getAttribute("role")).toBe(
      "listbox",
    );
  });

  test("ArrowDown highlights the first item", async () => {
    render(() => <Palette onRun={() => {}} />);

    await fireEvent.keyDown(commandRoot(), { key: "ArrowDown" });
    expect(activeText()).toBe("Open file");
  });

  test("arrows walk the list and wrap", async () => {
    render(() => <Palette onRun={() => {}} />);
    const root = commandRoot();

    await fireEvent.keyDown(root, { key: "ArrowDown" });
    await fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(activeText()).toBe("Go to line");

    await fireEvent.keyDown(root, { key: "ArrowDown" });
    await fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(activeText()).toBe("Open file");
  });

  test("ArrowUp from nothing highlights the last item", async () => {
    render(() => <Palette onRun={() => {}} />);

    await fireEvent.keyDown(commandRoot(), { key: "ArrowUp" });
    expect(activeText()).toBe("Delete project");
  });

  test("arrows walk only what survived the filter", async () => {
    render(() => <Palette onRun={() => {}} />);
    await typeInto(input(), "file");
    await fireEvent.keyDown(commandRoot(), { key: "ArrowDown" });

    expect(activeText()).toBe("Open file");
  });

  test("Enter runs the highlighted item", async () => {
    let ran: string | undefined;
    render(() => <Palette onRun={(v) => (ran = v)} />);
    const root = commandRoot();

    await fireEvent.keyDown(root, { key: "ArrowDown" });
    await fireEvent.keyDown(root, { key: "ArrowDown" });
    await fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(activeText()).toBe("Delete project");

    await fireEvent.keyDown(root, { key: "Enter" });
    expect(ran).toBe("Delete project");
  });

  test("Enter with nothing highlighted does nothing", async () => {
    let ran: string | undefined;
    render(() => <Palette onRun={(v) => (ran = v)} />);

    await fireEvent.keyDown(commandRoot(), { key: "Enter" });
    expect(ran).toBeUndefined();
  });

  test("Escape is reported so the host can close the palette", async () => {
    let escaped = false;
    render(() => <Palette onRun={() => {}} onEscape={() => (escaped = true)} />);

    await fireEvent.keyDown(commandRoot(), { key: "Escape" });
    expect(escaped).toBe(true);
  });

  test("running an item clears the query", async () => {
    render(() => <Palette onRun={() => {}} />);
    await typeInto(input(), "file");
    await fireEvent.keyDown(commandRoot(), { key: "ArrowDown" });
    await fireEvent.keyDown(commandRoot(), { key: "Enter" });

    expect(input().value).toBe("");
  });

  test("clicking an item runs it", async () => {
    let ran: string | undefined;
    render(() => <Palette onRun={(v) => (ran = v)} />);

    await fireEvent.click(document.querySelectorAll('[data-slot="command-item"]')[2]!);
    expect(ran).toBe("Delete project");
  });

  test("moving the pointer settles the highlight, so Enter agrees with it", async () => {
    let ran: string | undefined;
    render(() => <Palette onRun={(v) => (ran = v)} />);
    const root = commandRoot();

    await fireEvent.keyDown(root, { key: "ArrowDown" });
    await fireEvent.pointerMove(document.querySelectorAll('[data-slot="command-item"]')[2]!);
    await fireEvent.keyDown(root, { key: "Enter" });

    expect(ran).toBe("Delete project");
  });

  test("reports query changes to the host", async () => {
    const seen: string[] = [];
    render(() => <Palette onRun={() => {}} onQueryChange={(v) => seen.push(v)} />);

    await typeInto(input(), "go");
    expect(seen).toEqual(["go"]);
  });

  test("a controlled query drives the input", () => {
    const [value, setValue] = createSignal("open");
    render(() => (
      <Command value={value()} onValueChange={setValue}>
        <CommandInput />
        <CommandList>
          <CommandItem value="Open file">Open file</CommandItem>
        </CommandList>
      </Command>
    ));

    expect(input().value).toBe("open");
    // A query the component cannot change must not be filtered locally either.
    expect(itemTexts()).toEqual(["Open file"]);
  });
});

const Countries = (props: { onSelect: (value: string) => void }) => {
  const [open, setOpen] = createSignal(false);

  return (
    <Combobox open={open()} onOpenChange={setOpen}>
      <ComboboxAnchor>
        <label for="country">Country</label>
        <ComboboxInput id="country" placeholder="Search countries…" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" aria-label="Open list">▼</Button>
          </PopoverTrigger>
        </Popover>
        <ComboboxContent>
          <ComboboxList>
            <ComboboxEmpty>No country found.</ComboboxEmpty>
            {["Azerbaijan", "Austria", "Brazil", "Canada"].map((name) => (
              <ComboboxItem value={name} onSelect={props.onSelect}>
                {name}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxAnchor>
    </Combobox>
  );
};

const comboboxInput = () => document.querySelector<HTMLInputElement>('input[id="country"]')!;
const comboboxItems = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]')).map((element) =>
    element.textContent ?? "",
  );

describe("Combobox", () => {
  test("the input is a combobox that controls a listbox", () => {
    render(() => <Countries onSelect={() => {}} />);

    expect(comboboxInput().getAttribute("role")).toBe("combobox");
    expect(comboboxInput().getAttribute("aria-autocomplete")).toBe("list");
  });

  test("lists every option before the panel is opened", async () => {
    render(() => <Countries onSelect={() => {}} />);

    await typeInto(comboboxInput(), "Can");
    expect(comboboxItems()).toEqual(["Canada"]);
  });

  test("choosing an option reports it", async () => {
    let chosen: string | undefined;
    render(() => <Countries onSelect={(v) => (chosen = v)} />);

    await typeInto(comboboxInput(), "Bra");
    await fireEvent.click(document.querySelector('[data-slot="combobox-item"]')!);

    expect(chosen).toBe("Brazil");
  });

  test("matches regardless of case, in either direction", async () => {
    render(() => <Countries onSelect={() => {}} />);

    await typeInto(comboboxInput(), "brazil");
    expect(comboboxItems()).toEqual(["Brazil"]);

    await typeInto(comboboxInput(), "BRAZIL");
    expect(comboboxItems()).toEqual(["Brazil"]);
  });

  test("an empty query lists everything", async () => {
    render(() => <Countries onSelect={() => {}} />);
    await typeInto(comboboxInput(), "");

    expect(comboboxItems()).toEqual(["Azerbaijan", "Austria", "Brazil", "Canada"]);
  });
});
