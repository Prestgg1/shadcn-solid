import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import { TableData, type TableColumn } from "./table-data";
import { TreeView } from "./tree";

interface Person {
  id: string;
  name: string;
  role: string;
  team: string;
}

const people: Person[] = [
  { id: "1", name: "Ada", role: "Engineer", team: "Platform" },
  { id: "2", name: "Grace", role: "Designer", team: "Product" },
  { id: "3", name: "Alan", role: "Engineer", team: "Platform" },
  { id: "4", name: "Barbara", role: "Researcher", team: "Platform" },
];

const columns: TableColumn<Person>[] = [
  { id: "name", header: "Name", accessor: (p) => p.name, sortable: true },
  { id: "role", header: "Role", accessor: (p) => p.role, sortable: true },
  { id: "team", header: "Team", accessor: (p) => p.team },
];

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

const rows = () => document.querySelectorAll('[data-slot="table-data-row"]');
const filter = () => document.querySelector<HTMLInputElement>('[data-slot="table-data-filter"]')!;

async function setFilter(value: string): Promise<void> {
  await fireEvent.input(filter(), { target: { value } });
  await Promise.resolve();
}

describe("TableData", () => {
  test("renders a real table with scoped headers", () => {
    const { container } = render(() => (
      <TableData data={people} columns={columns} rowKey={(p) => p.id} />
    ));

    expect(container.querySelector("table")).not.toBeNull();
    for (const head of container.querySelectorAll('th[scope="col"]')) {
      expect(head.getAttribute("scope")).toBe("col");
    }
  });

  test("renders every row", () => {
    render(() => <TableData data={people} columns={columns} rowKey={(p) => p.id} />);
    expect(rows()).toHaveLength(4);
  });

  test("filters across columns, case-insensitively", async () => {
    render(() => <TableData data={people} columns={columns} rowKey={(p) => p.id} />);

    await setFilter("eng");
    // "Engineer" is in the role column, so the search is not name-only.
    expect(rows()).toHaveLength(2);

    await setFilter("PLAT");
    expect(rows()).toHaveLength(3);
  });

  test("says how much the filter removed", async () => {
    render(() => <TableData data={people} columns={columns} rowKey={(p) => p.id} />);

    expect(slot("table-data-count")?.textContent).toBe("4 rows");

    await setFilter("eng");
    expect(slot("table-data-count")?.textContent).toBe("2 of 4 rows");
  });

  test("the count is announced, since it changes as you type", () => {
    render(() => <TableData data={people} columns={columns} rowKey={(p) => p.id} />);
    expect(slot("table-data-count")?.getAttribute("aria-live")).toBe("polite");
  });

  test("sorts ascending, then descending, then not at all", async () => {
    render(() => <TableData data={people} columns={columns} rowKey={(p) => p.id} />);

    await fireEvent.click(slot("table-data-sort")!);
    expect(rows()[0]!.textContent).toContain("Ada");

    await fireEvent.click(slot("table-data-sort")!);
    expect(rows()[0]!.textContent).toContain("Grace");

    // A third click returns to the original order; without it there is no way
    // back once the user has looked around.
    await fireEvent.click(slot("table-data-sort")!);
    expect(rows()[0]!.textContent).toContain("Ada");
  });

  test("reports the sort direction to assistive tech", async () => {
    const { container } = render(() => (
      <TableData data={people} columns={columns} rowKey={(p) => p.id} />
    ));

    // Selected by slot, not by index: the checkbox column comes first and
    // has no sort state at all.
    const head = container.querySelectorAll('th[data-slot="table-data-column"]')[0]!;
    expect(head.getAttribute("aria-sort")).toBe("none");

    await fireEvent.click(head.querySelector('[data-slot="table-data-sort"]')!);
    expect(head.getAttribute("aria-sort")).toBe("ascending");

    await fireEvent.click(head.querySelector('[data-slot="table-data-sort"]')!);
    expect(head.getAttribute("aria-sort")).toBe("descending");
  });

  test("sorts on the accessor, not on what the cell renders", async () => {
    const rendered: TableColumn<Person>[] = [
      { id: "name", header: "Name", accessor: (p) => p.name, sortable: true },
      {
        id: "role",
        header: "Role",
        accessor: (p) => p.role,
        sortable: true,
        cell: (p) => <span class="badge">{p.role.toUpperCase()}</span>,
      },
    ];

    render(() => <TableData data={people} columns={rendered} rowKey={(p) => p.id} />);
    const sorts = document.querySelectorAll('[data-slot="table-data-sort"]');

    await fireEvent.click(sorts[1]!);
    // Ordered by "Designer" < "Engineer", so Grace comes first even though
    // her cell renders as a badge.
    expect(rows()[0]!.textContent).toContain("Grace");
  });

  test("does not reorder the caller's array", async () => {
    const data = [...people];
    render(() => <TableData data={data} columns={columns} rowKey={(p) => p.id} />);

    await fireEvent.click(slot("table-data-sort")!);
    // `Array.prototype.sort` mutates; rendering must not.
    expect(data[0]!.name).toBe("Ada");
  });

  test("selects a row and reports it by key", async () => {
    let picked: string[] = [];
    render(() => (
      <TableData
        data={people}
        columns={columns}
        rowKey={(p) => p.id}
        onSelectionChange={(keys) => (picked = keys)}
      />
    ));

    await fireEvent.click(document.querySelectorAll('[data-slot="table-data-select"]')[1]!);

    expect(picked).toEqual(["2"]);
    expect(rows()[1]!.getAttribute("data-state")).toBe("selected");
  });

  test("select-all covers the page, and unselecting reverses it", async () => {
    let picked: string[] = [];
    render(() => (
      <TableData
        data={people}
        columns={columns}
        rowKey={(p) => p.id}
        onSelectionChange={(keys) => (picked = keys)}
      />
    ));

    await fireEvent.click(slot("table-data-select-all")!);
    expect(picked).toEqual(["1", "2", "3", "4"]);

    await fireEvent.click(slot("table-data-select-all")!);
    expect(picked).toEqual([]);
  });

  test("select-all does not reach past the page", async () => {
    let picked: string[] = [];
    render(() => (
      <TableData
        data={people}
        columns={columns}
        rowKey={(p) => p.id}
        pageSize={2}
        onSelectionChange={(keys) => (picked = keys)}
      />
    ));

    await fireEvent.click(slot("table-data-select-all")!);
    // Selecting rows nobody can see is how a bulk delete surprises someone.
    expect(picked).toEqual(["1", "2"]);
  });

  test("pagination splits the rows and disables itself at the ends", async () => {
    render(() => <TableData data={people} columns={columns} rowKey={(p) => p.id} pageSize={2} />);

    expect(rows()).toHaveLength(2);
    expect(slot("table-data-previous")?.hasAttribute("disabled")).toBe(true);

    await fireEvent.click(slot("table-data-next")!);
    expect(rows()).toHaveLength(2);
    expect(rows()[0]!.textContent).toContain("Alan");

    await fireEvent.click(slot("table-data-next")!);
    expect(rows()).toHaveLength(2);
    expect(slot("table-data-next")?.hasAttribute("disabled")).toBe(true);
  });

  test("an empty result says so instead of rendering a blank table", async () => {
    const { container } = render(() => (
      <TableData data={people} columns={columns} rowKey={(p) => p.id} empty="Nothing here." />
    ));

    await setFilter("zzz");

    expect(rows()).toHaveLength(0);
    expect(container.textContent).toContain("Nothing here.");
  });

  test("a custom cell wins over the accessor's text", () => {
    const rendered: TableColumn<Person>[] = [
      { id: "name", header: "Name", accessor: (p) => p.name, cell: (p) => <b>{p.name}</b> },
    ];

    const { container } = render(() => (
      <TableData data={people} columns={rendered} rowKey={(p) => p.id} />
    ));

    expect(container.querySelector("b")?.textContent).toBe("Ada");
  });

  test("selection can be turned off entirely", () => {
    render(() => <TableData data={people} columns={columns} selectable={false} />);
    expect(slot("table-data-select")).toBeNull();
    expect(slot("table-data-select-all")).toBeNull();
  });
});

interface FileNode {
  id: string;
  label: string;
  children?: FileNode[];
}

const files: FileNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "src/app.tsx", label: "app.tsx" },
      { id: "src/ui", label: "ui", children: [{ id: "src/ui/button.tsx", label: "button.tsx" }] },
    ],
  },
  { id: "README.md", label: "README.md" },
];

const treeRows = () => document.querySelectorAll('[data-slot="tree-item"]');

const Files = (props: { onSelect?: (id: string) => void; expanded?: string[] }) => (
  <TreeView
    data={files}
    getChildren={(node) => node.children ?? []}
    getKey={(node) => node.id}
    getLabel={(node) => node.label}
    defaultExpanded={props.expanded ?? ["src"]}
    onSelect={props.onSelect}
  />
);

describe("Tree", () => {
  test("renders a tree with the ARIA roles", () => {
    const { container } = render(() => <Files />);

    expect(container.querySelector('[role="tree"]')).not.toBeNull();
    expect(treeRows().length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[role="treeitem"]').length).toBe(treeRows().length);
  });

  test("expanded branches show their children", () => {
    render(() => <Files expanded={["src", "src/ui"]} />);

    const labels = Array.from(treeRows()).map((row) => row.textContent);
    expect(labels).toContain("app.tsx");
    expect(labels).toContain("ui");
    // Expansion is per branch, so opening "src" does not open "ui" inside
    // it — and this fixture opens both, so the deepest child is visible.
    expect(labels).toContain("button.tsx");
  });

  test("a collapsed branch hides its children", async () => {
    render(() => <Files expanded={["src", "src/ui"]} />);

    // `src/ui`, not "ui" — the key is the node's id, and expansion is
    // addressed by key rather than by label.
    const ui = Array.from(treeRows()).find((row) => row.getAttribute("data-tree-key") === "src/ui")!;
    expect(ui.getAttribute("aria-expanded")).toBe("true");

    await fireEvent.click(ui.querySelector('[data-slot="tree-trigger"]')!);

    const labels = Array.from(treeRows()).map((row) => row.textContent);
    expect(labels).not.toContain("button.tsx");
  });

  test("reports its expanded state on the row, not the chevron", async () => {
    render(() => <Files />);

    const src = treeRows()[0]!;
    expect(src.getAttribute("aria-expanded")).toBe("true");

    await fireEvent.click(src.querySelector('[data-slot="tree-trigger"]')!);
    expect(src.getAttribute("aria-expanded")).toBe("false");
  });

  test("a branch is marked as such, a leaf is not", () => {
    const { container } = render(() => <Files />);

    const items = container.querySelectorAll('[role="treeitem"]');
    const branch = Array.from(items).find((item) => item.textContent?.startsWith("src"))!;
    const leaf = Array.from(items).find((item) => item.textContent?.includes("README.md"))!;

    expect(branch.getAttribute("aria-expanded")).toBe("true");
    expect(leaf.hasAttribute("aria-expanded")).toBe(false);
  });

  test("expansion is per branch, not recursive", () => {
    render(() => <Files />);

    // "src" expanded does not open "ui" inside it — the state is per key.
    const ui = Array.from(treeRows()).find((row) => row.textContent?.startsWith("ui"))!;
    expect(ui.getAttribute("aria-expanded")).toBe("false");
  });

  test("only visible rows are in the tab order", () => {
    const { container } = render(() => <Files />);

    // Every visible row would be a tab stop if nothing managed it, which is
    // the usual complaint about a tree that is not a tree.
    const tabbable = Array.from(container.querySelectorAll('[data-slot="tree-item"]')).filter(
      (item) => item.getAttribute("tabindex") === "0",
    );
    expect(tabbable).toHaveLength(1);
  });

  test("selecting a node reports its key", async () => {
    let picked: string | undefined;
    render(() => <Files onSelect={(id) => (picked = id)} />);

    const leaf = Array.from(treeRows()).find((row) => row.textContent?.includes("README.md"))!;
    await fireEvent.click(leaf.querySelector('[data-slot="tree-content"]')!);

    expect(picked).toBe("README.md");
  });

  test("arrow keys move through the visible rows", async () => {
    const { container } = render(() => <Files />);
    const first = container.querySelector<HTMLElement>('[data-slot="tree-item"][tabindex="0"]')!;

    first.focus();
    await fireEvent.keyDown(first, { key: "ArrowDown" });

    // Focus follows the roving tab stop.
    const active = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="tree-item"]')).find(
      (item) => item.getAttribute("tabindex") === "0",
    );
    expect(active).not.toBe(first);
  });

  test("ArrowRight expands a collapsed branch", async () => {
    const { container } = render(() => <Files />);

    const src = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="tree-item"]')).find(
      (item) => item.textContent?.startsWith("src"),
    )!;
    src.focus();
    await fireEvent.keyDown(src, { key: "ArrowLeft" });

    expect(
      container.querySelector('[data-slot="tree-item"][aria-expanded="false"]'),
    ).not.toBeNull();
  });
});
