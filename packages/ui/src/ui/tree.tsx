import type { JSX } from "@solidjs/web";
import { For, Show, createContext, createMemo, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * Tree — a hierarchical list, as in a file browser.
 *
 * ```tsx
 * <TreeView
 *   data={files}
 *   getChildren={(node) => node.children ?? []}
 *   getKey={(node) => node.id}
 *   getLabel={(node) => node.name}
 *   defaultExpanded={["src"]}
 * />
 * ```
 *
 * Follows the WAI-ARIA tree pattern, which is more than adding roles:
 *
 * - **One tab stop for the whole tree.** Arrow keys move between rows and Tab
 *   leaves the tree entirely. Without this, a large tree costs the user one
 *   tab press per row — the usual complaint about "trees" that are really
 *   just nested lists.
 * - **The tree is flat.** A collapsed branch is not rendered at all, so "the
 *   third visible row" *is* the third row in the DOM, and ArrowDown cannot
 *   land on something the user cannot see.
 * - **Right and Left do double duty.** Right opens a closed branch and steps
 *   into an open one; Left steps out, and closes a branch you are already
 *   inside.
 */

export interface TreeAdapter<T> {
  /** The node's children, or `[]` for a leaf. */
  getChildren: (node: T) => T[];
  /** Stable identity, for expansion state and `onSelect`. */
  getKey: (node: T) => string;
  getLabel: (node: T) => string;
  isDisabled?: (node: T) => boolean;
}

/** One rendered row: the node, how deep it is, and where it can go. */
export interface TreeRowModel<T> {
  node: T;
  key: string;
  depth: number;
  hasChildren: boolean;
  /** The enclosing branch's key, for ArrowLeft to step out to. */
  parentKey?: string;
}

interface TreeState<T> {
  expanded: () => string[];
  isExpanded: (key: string) => boolean;
  toggle: (key: string) => void;
  expand: (key: string) => void;
  collapse: (key: string) => void;
  selected: () => string | undefined;
  select: (key: string) => void;
  visible: () => TreeRowModel<T>[];
  visibleKeys: () => string[];
  /**
   * The row that holds `tabindex="0"` — where Tab enters the tree. Follows
   * the selection once there is one, so re-entering the tree puts the user
   * back where they left rather than at the top.
   */
  tabStop: () => string | undefined;
}

const TreeContext = createContext<TreeState<never>>();
/** The adapter, so each row can read its node without five more props. */
const TreeAdapterContext = createContext<TreeAdapter<unknown>>();

function useTree<T>(): TreeState<T> {
  const state = useContext(TreeContext);
  if (!state) throw new Error("Tree parts must be used inside a <TreeView>.");
  return state as unknown as TreeState<T>;
}

function useAdapter<T>(): TreeAdapter<T> {
  const adapter = useContext(TreeAdapterContext);
  if (!adapter) throw new Error("Tree rows must be rendered inside a <TreeView>.");
  return adapter as TreeAdapter<T>;
}

export interface TreeViewProps<T> extends TreeAdapter<T> {
  data: T[];
  /** Keys open on first render. */
  defaultExpanded?: string[];
  /** Controlled expansion. */
  expanded?: string[];
  onExpandedChange?: (expanded: string[]) => void;
  /** Controlled selection, as a key. */
  selected?: string;
  onSelect?: (key: string) => void;
  class?: string;
  /** The tree's accessible name. */
  "aria-label"?: string;
  [key: string]: unknown;
}

export function TreeView<T>(props: TreeViewProps<T>): JSX.Element {
  const [local, rest] = split(props, [
    "data",
    "getChildren",
    "getKey",
    "getLabel",
    "isDisabled",
    "defaultExpanded",
    "expanded",
    "onExpandedChange",
    "selected",
    "onSelect",
    "class",
    "children",
    "aria-label",
  ]);

  const adapter: TreeAdapter<T> = {
    getChildren: (node) => local.getChildren(node) ?? [],
    getKey: (node) => local.getKey(node),
    getLabel: (node) => local.getLabel(node),
    isDisabled: local.isDisabled,
  };

  const expandedControlled = () => local.expanded !== undefined;
  const [uncontrolledExpanded, setUncontrolledExpanded] = createSignal<string[]>(
    local.defaultExpanded ?? [],
  );
  const expanded = () => (expandedControlled() ? (local.expanded ?? []) : uncontrolledExpanded());

  const setExpanded = (next: string[]) => {
    if (!expandedControlled()) setUncontrolledExpanded(next);
    local.onExpandedChange?.(next);
  };

  const [uncontrolledSelected, setUncontrolledSelected] = createSignal<string>();
  const selected = () => local.selected ?? uncontrolledSelected();

  const select = (key: string) => {
    if (local.selected === undefined) setUncontrolledSelected(key);
    local.onSelect?.(key);
  };

  /**
   * Depth-first over the *expanded* branches only.
   *
   * Derived rather than tracked per node, so collapsing a branch takes its
   * whole subtree out in one step — there is no per-node bookkeeping to fall
   * out of step with what is on screen.
   */
  /**
   * The previous pass's models, keyed by node key.
   *
   * Plain `Map`, not a signal: it is a cache for identity, not state, and
   * writing a signal inside a memo would make the memo depend on itself.
   */
  let previousModels = new Map<string, TreeRowModel<T>>();

  const computeRows = (): TreeRowModel<T>[] => {
    const rows: TreeRowModel<T>[] = [];

    const walk = (nodes: T[], depth: number, parentKey?: string) => {
      for (const node of nodes) {
        const key = adapter.getKey(node);
        const children = adapter.getChildren(node);
        const hasChildren = children.length > 0;

        rows.push({ node, key, depth, hasChildren, parentKey });

        if (hasChildren && expanded().includes(key)) walk(children, depth + 1, key);
      }
    };

    walk(local.data, 0);
    return rows;
  };

  /**
   * Depth-first over the *expanded* branches only, with stable identities.
   *
   * Derived rather than tracked per node, so collapsing a branch takes its
   * whole subtree out in one step — there is no per-node bookkeeping to fall
   * out of step with what is on screen.
   *
   * The identity part is what makes the tree usable. `For` keeps a row's DOM
   * only while the *object* it renders stays the same object, and expanding a
   * branch builds fresh objects for everything. Handing back the previous
   * model for any row whose key, node and depth are unchanged means `<For>`
   * leaves those rows alone — so a row does not lose focus, and its
   * `aria-expanded` updates in place instead of on a detached element that
   * happens to be identical.
   */
  const visible = createMemo(() => {
    const computed = computeRows();
    const next = new Map<string, TreeRowModel<T>>();

    for (const row of computed) {
      const old = previousModels.get(row.key);
      next.set(
        row.key,
        old && old.node === row.node && old.depth === row.depth ? old : row,
      );
    }

    previousModels = next;
    // The *reused* models, in order — returning `computed` here would hand
    // `For` fresh objects and undo the whole point.
    return computed.map((row) => next.get(row.key)!);
  });

  const state: TreeState<T> = {
    expanded,
    isExpanded: (key) => expanded().includes(key),
    toggle: (key) =>
      setExpanded(
        expanded().includes(key) ? expanded().filter((entry) => entry !== key) : [...expanded(), key],
      ),
    expand: (key) => setExpanded(expanded().includes(key) ? expanded() : [...expanded(), key]),
    collapse: (key) => setExpanded(expanded().filter((entry) => entry !== key)),
    selected,
    select,
    visible,
    visibleKeys: () => visible().map((row) => row.key),
    tabStop: () => {
      const keys = visible().map((row) => row.key);
      const current = selected();
      return current && keys.includes(current) ? current : keys[0];
    },
  };

  return (
    <TreeAdapterContext value={adapter as TreeAdapter<unknown>}>
      <TreeContext value={state as unknown as TreeState<never>}>
        <div
          data-slot="tree"
          role="tree"
          // The keyboard model, announced so a screen reader user knows what
          // the arrow keys will do before trying them.
          aria-label={local["aria-label"] as string | undefined}
          class={cn("flex flex-col gap-0.5 text-sm", local.class)}
          onKeyDown={onTreeKeyDown}
          {...rest}
        >
          <For each={visible()}>{(row) => <TreeRow row={row} />}</For>
        </div>
      </TreeContext>
    </TreeAdapterContext>
  );
}

/**
 * Move the roving tab stop and the focus together.
 *
 * Both are needed: the `tabindex` decides where Tab *enters* the tree, and
 * the `focus()` decides where the arrow keys continue from. Setting only the
 * attribute leaves the caret behind in a tree the user has visually left.
 */
function focusKey(key: string | undefined): void {
  if (!key) return;

  for (const item of document.querySelectorAll<HTMLElement>("[data-tree-key]")) {
    item.setAttribute("tabindex", item.getAttribute("data-tree-key") === key ? "0" : "-1");
  }

  for (const item of document.querySelectorAll<HTMLElement>("[data-tree-key]")) {
    if (item.getAttribute("data-tree-key") === key) {
      item.focus();
      return;
    }
  }
}

function onTreeKeyDown(event: KeyboardEvent): void {
  const active = document.activeElement as HTMLElement | null;
  const key = active?.getAttribute("data-tree-key");
  if (!key) return;

  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-tree-key]"));
  const keys = rows.map((item) => item.getAttribute("data-tree-key") ?? "");
  const at = keys.indexOf(key);
  if (at === -1) return;

  const isExpanded = (item: HTMLElement) => item.getAttribute("aria-expanded") === "true";
  const hasChildren = rows[at]!.getAttribute("aria-expanded") !== null;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      focusKey(keys[(at + 1) % keys.length]);
      return;

    case "ArrowUp":
      event.preventDefault();
      focusKey(keys[(at - 1 + keys.length) % keys.length]);
      return;

    case "ArrowRight": {
      event.preventDefault();
      if (!hasChildren) return;
      // Open a closed branch; step into an open one. Both are what the key
      // means in every file browser.
      if (!isExpanded(rows[at]!)) {
        rows[at]!.querySelector<HTMLElement>("[data-slot=tree-trigger]")?.click();
        return;
      }
      focusKey(keys[at + 1]);
      return;
    }

    case "ArrowLeft": {
      event.preventDefault();
      if (hasChildren && isExpanded(rows[at]!)) {
        rows[at]!.querySelector<HTMLElement>("[data-slot=tree-trigger]")?.click();
        return;
      }
      focusKey(rows[at]!.getAttribute("data-tree-parent") ?? undefined);
      return;
    }

    case "Home":
      event.preventDefault();
      focusKey(keys[0]);
      return;

    case "End":
      event.preventDefault();
      focusKey(keys[keys.length - 1]);
      return;

    default:
      // Enter and Space select; Space would otherwise scroll the page.
      if (event.key === "Enter" || event.key === " ") {
        if (rows[at]!.getAttribute("aria-disabled") === "true") return;
        event.preventDefault();
        rows[at]!.click();
      }
  }
}

function TreeRow<T>(props: { row: TreeRowModel<T> }): JSX.Element {
  const tree = useTree<T>();
  const adapter = useAdapter<T>();

  const key = () => props.row.key;
  const selected = () => tree.selected() === key();
  const disabled = () => adapter.isDisabled?.(props.row.node) ?? false;

  return (
    <div
      data-slot="tree-item"
      data-tree-key={key()}
      data-tree-parent={props.row.parentKey}
      role="treeitem"
      aria-selected={selected() ? "true" : "false"}
      aria-disabled={disabled() ? "true" : undefined}
      // Only a branch carries `aria-expanded`. On a leaf it would tell a
      // screen reader the node can be opened, which it cannot.
      aria-expanded={props.row.hasChildren ? (tree.isExpanded(key()) ? "true" : "false") : undefined}
      // One tab stop for the whole tree.
      tabindex={tree.tabStop() === key() ? 0 : -1}
      style={{ "padding-left": `${props.row.depth * 16 + 8}px` }}
      class={cn(
        "flex cursor-default items-center gap-1 rounded-sm py-1.5 pr-2 outline-hidden select-none",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        selected() && "bg-accent/50 font-medium",
      )}
      onClick={() => {
        if (disabled()) return;
        tree.select(key());
      }}
    >
      <Show
        when={props.row.hasChildren}
        fallback={<span data-slot="tree-spacer" aria-hidden="true" class="size-4 shrink-0" />}
      >
        <button
          data-slot="tree-trigger"
          type="button"
          // Reached by the row's own click and by ArrowRight/Left, so it must
          // not be a second tab stop inside the tree.
          tabindex={-1}
          aria-hidden="true"
          class="grid size-4 shrink-0 place-items-center rounded-sm hover:bg-muted"
          onClick={(event) => {
            event.stopPropagation();
            tree.toggle(key());
          }}
        >
          <Chevron open={tree.isExpanded(key())} />
        </button>
      </Show>

      <span data-slot="tree-content" class="flex min-w-0 flex-1 items-center gap-2 truncate">
        {adapter.getLabel(props.row.node)}
      </span>
    </div>
  );
}

function Chevron(props: { open: boolean }): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={cn("size-3.5 transition-transform", props.open && "rotate-90")}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}