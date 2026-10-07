import type { JSX } from "@solidjs/web";
import { For, Show, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * TableData — a table that sorts, filters, paginates and selects rows.
 *
 * ```tsx
 * <TableData
 *   data={people}
 *   columns={[
 *     { id: "name", header: "Name", accessor: (p) => p.name, sortable: true },
 *     { id: "role", header: "Role", accessor: (p) => p.role },
 *   ]}
 *   rowKey={(p) => p.id}
 *   selectable
 *   pageSize={10}
 * />
 * ```
 *
 * This is a `<table>`, not a grid of `<div>`s. A data table is a table: it
 * needs header cells with `scope`, the `aria-sort` that says which column is
 * ordered, and Ctrl+C working on the text inside it. All of that comes free
 * from the element and none of it comes back from divs.
 *
 * `columns` is data rather than JSX because the parts that have to know about
 * *all* the rows — the header's sort buttons, the row count, the empty state,
 * pagination — cannot be built from children alone.
 *
 * Sorting works on the `accessor`, not on what `cell` renders, so a column
 * showing a badge still orders by the value behind it.
 */

export type SortDirection = "asc" | "desc";

export interface TableColumn<T> {
  /** Identifies the column. */
  id: string;
  header: JSX.Element | string;
  /** Reads the cell's value. Drives sorting, filtering and the CSV. */
  accessor: (row: T) => string | number;
  /** Renders the cell. Falls back to the accessor's value as text. */
  cell?: (row: T) => JSX.Element;
  sortable?: boolean;
  /** Excluded from the filter's haystack. On by default to filter. */
  filterable?: boolean;
  /** Extra class for every cell in this column. */
  class?: string;
  /** Extra class for the header cell. */
  headerClass?: string;
  /** Extra class for the row while this cell is the row's primary action. */
  cellClass?: string;
}

export interface TableDataProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  /** Stable identity per row. Without it the index is used. */
  rowKey?: (row: T, index: number) => string;
  /** Add a checkbox per row. On by default. */
  selectable?: boolean;
  /** Controlled selection, as row keys. */
  selected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  /** Rows per page. `10` by default; `0` shows every row. */
  pageSize?: number;
  /** Controlled page index, zero-based. */
  page?: number;
  onPageChange?: (page: number) => void;
  class?: string;
  /** Rendered when no row matches. */
  empty?: JSX.Element;
  [key: string]: unknown;
}

interface TableState<T> {
  columns: () => TableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  selectable: () => boolean;

  query: () => string;
  setQuery: (query: string) => void;
  /** Every row after filtering and sorting, across all pages. */
  matching: () => T[];
  /** The rows on the current page. */
  pageRows: () => T[];
  total: () => number;

  sort: () => { id: string; direction: SortDirection } | undefined;
  toggleSort: (id: string) => void;

  page: () => number;
  setPage: (page: number) => void;
  pageCount: () => number;
  pageSize: () => number;

  selected: () => string[];
  isSelected: (key: string) => boolean;
  toggleRow: (key: string) => void;
  toggleAll: () => void;
  allOnPageSelected: () => boolean;
}

const TableStateContext = createContext<TableState<never>>();

function useTable<T>(): TableState<T> {
  const state = useContext(TableStateContext);
  if (!state) throw new Error("TableData parts must be used inside a <TableData>.");
  return state as unknown as TableState<T>;
}

const text = (value: string | number): string => (typeof value === "number" ? String(value) : value);

export function TableData<T>(props: TableDataProps<T>): JSX.Element {
  const [local, rest] = split(props, [
    "data",
    "columns",
    "rowKey",
    "selectable",
    "selected",
    "onSelectionChange",
    "pageSize",
    "page",
    "onPageChange",
    "class",
    "empty",
    "loading",
  ]);

  const [query, setQuery] = createSignal("");
  const [sort, setSort] = createSignal<{ id: string; direction: SortDirection }>();
  const [uncontrolledPage, setUncontrolledPage] = createSignal(0);
  const [uncontrolledSelected, setUncontrolledSelected] = createSignal<string[]>([]);

  const pageControlled = () => local.page !== undefined;
  const selectionControlled = () => local.selected !== undefined;

  const page = () => (pageControlled() ? (local.page ?? 0) : uncontrolledPage());
  const selected = () => (selectionControlled() ? (local.selected ?? []) : uncontrolledSelected());

  const size = () => local.pageSize ?? 10;

  const rowKey = (row: T, index: number): string =>
    local.rowKey ? local.rowKey(row, index) : String(index);

  const setPage = (next: number) => {
    if (!pageControlled()) setUncontrolledPage(next);
    local.onPageChange?.(next);
  };

  const setSelected = (next: string[]) => {
    if (!selectionControlled()) setUncontrolledSelected(next);
    local.onSelectionChange?.(next);
  };

  /** Every row after filtering, then sorting. */
  const matching = (): T[] => {
    const needle = query().trim().toLowerCase();

    const found = needle
      ? local.data.filter((row) =>
          local.columns.some(
            (column) =>
              column.filterable !== false && text(column.accessor(row)).toLowerCase().includes(needle),
          ),
        )
      : local.data;

    const order = sort();
    const column = order ? local.columns.find((entry) => entry.id === order.id) : undefined;
    if (!order || !column) return found;

    const direction = order.direction === "asc" ? 1 : -1;
    // A copy first: `sort` mutates, and reordering the caller's array is not
    // something rendering should do.
    return [...found].sort((a, b) => {
      const left = column.accessor(a);
      const right = column.accessor(b);
      if (left === right) return 0;
      return (left < right ? -1 : 1) * direction;
    });
  };

  const pageRows = (): T[] => {
    const all = matching();
    if (size() <= 0) return all;
    const start = page() * size();
    return all.slice(start, start + size());
  };

  const pageCount = () => (size() <= 0 ? 1 : Math.max(1, Math.ceil(matching().length / size())));

  const state: TableState<T> = {
    columns: () => local.columns,
    rowKey,
    selectable: () => local.selectable ?? true,
    query,
    setQuery,
    matching,
    pageRows,
    total: () => local.data.length,
    sort,
    // A third click clears the ordering rather than flipping again — otherwise
    // there is no way back to the original order.
    toggleSort: (id) =>
      setSort((previous) =>
        previous?.id !== id
          ? { id, direction: "asc" }
          : previous.direction === "asc"
            ? { id, direction: "desc" }
            : undefined,
      ),
    page,
    setPage,
    pageCount,
    pageSize: size,
    selected,
    isSelected: (key) => selected().includes(key),
    toggleRow: (key) =>
      setSelected(
        selected().includes(key) ? selected().filter((entry) => entry !== key) : [...selected(), key],
      ),
    // Scoped to the current page: "select all" that silently selects rows
    // nobody can see is a bug report waiting to happen.
    toggleAll: () => {
      const keys = pageRows().map(rowKey);
      const all = keys.every((key) => selected().includes(key));
      setSelected(all ? selected().filter((key) => !keys.includes(key)) : [...new Set([...selected(), ...keys])]);
    },
    allOnPageSelected: () => {
      const keys = pageRows().map(rowKey);
      return keys.length > 0 && keys.every((key) => selected().includes(key));
    },
  };

  return (
    <TableStateContext value={state as unknown as TableState<never>}>
      <div data-slot="table-data" class={cn("flex w-full flex-col gap-3", local.class)} {...rest}>
        <TableToolbar />
        <div data-slot="table-data-container" class="relative w-full overflow-x-auto">
          <table
            data-slot="table-data-table"
            aria-busy={local.loading ? "true" : undefined}
            class="w-full caption-bottom text-sm"
          >
            <TableHead />
            <TableBodyGrid empty={local.empty} />
            <TableFoot />
          </table>
        </div>
      </div>
    </TableStateContext>
  );
}

/** The filter box, and a count that says what the filter did. */
function TableToolbar(): JSX.Element {
  const table = useTable<unknown>();

  return (
    <div data-slot="table-data-toolbar" class="flex flex-wrap items-center justify-between gap-2">
      <input
        data-slot="table-data-filter"
        type="search"
        placeholder="Filter rows…"
        aria-label="Filter rows"
        value={table.query()}
        class="h-9 w-full max-w-64 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) =>
          table.setQuery(event.currentTarget.value)
        }
      />

      {/* `aria-live` because the count changes as you type, and a screen
          reader user needs to know the filter did something. */}
      <p data-slot="table-data-count" aria-live="polite" class="text-sm text-muted-foreground">
        {table.matching().length === table.total()
          ? `${table.total()} rows`
          : `${table.matching().length} of ${table.total()} rows`}
      </p>
    </div>
  );
}

function TableHead(): JSX.Element {
  const table = useTable<unknown>();
  const order = () => table.sort();

  return (
    <thead data-slot="table-data-head" class="[&_tr]:border-b">
      <tr class="h-10">
        <Show when={table.selectable()}>
          <th scope="col" class="w-10 px-2">
            <TableSelectAll />
          </th>
        </Show>
        <For each={table.columns()}>
          {(column) => (
            <th
              scope="col"
              data-slot="table-data-column"
              aria-sort={
                order()?.id === column.id
                  ? order()!.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : column.sortable
                    ? "none"
                    : undefined
              }
              class={cn("px-3 text-left align-middle font-medium text-muted-foreground", column.headerClass)}
            >
              <Show when={column.sortable} fallback={column.header}>
                <button
                  data-slot="table-data-sort"
                  type="button"
                  class="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => table.toggleSort(column.id)}
                >
                  {column.header}
                  <SortIcon direction={order()?.id === column.id ? order()!.direction : undefined} />
                </button>
              </Show>
            </th>
          )}
        </For>
      </tr>
    </thead>
  );
}

function SortIcon(props: { direction?: SortDirection }): JSX.Element {
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
      class={cn(
        "size-3.5 transition-transform",
        // Faint while unsorted, so a neutral column does not look ordered.
        props.direction === undefined && "opacity-30",
        props.direction === "desc" && "rotate-180",
      )}
    >
      <path d="m5 15 7-7 7 7" />
    </svg>
  );
}

function TableSelectAll(): JSX.Element {
  const table = useTable<unknown>();

  return (
    <input
      data-slot="table-data-select-all"
      type="checkbox"
      aria-label="Select all rows on this page"
      checked={table.allOnPageSelected()}
      class="size-4 accent-primary"
      onChange={table.toggleAll}
    />
  );
}

function TableBodyGrid(props: { empty?: JSX.Element }): JSX.Element {
  const table = useTable<unknown>();

  return (
    <tbody data-slot="table-data-body">
      <Show
        when={table.pageRows().length > 0}
        fallback={
          <tr>
            <td colspan={table.columns().length + 1} class="p-8 text-center text-sm text-muted-foreground">
              {props.empty ?? "No rows."}
            </td>
          </tr>
        }
      >
        <For each={table.pageRows()}>
          {(row, index) => <TableDataRow row={row} index={index()} />}
        </For>
      </Show>
    </tbody>
  );
}

function TableDataRow(props: { row: unknown; index: number }): JSX.Element {
  const table = useTable<unknown>();
  const row = () => props.row;
  const key = () => table.rowKey(row(), props.index);

  return (
    <tr
      data-slot="table-data-row"
      data-state={table.isSelected(key()) ? "selected" : undefined}
      class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
    >
      <Show when={table.selectable()}>
        <td class="w-10 px-2">
          <input
            data-slot="table-data-select"
            type="checkbox"
            aria-label={`Select row ${props.index + 1}`}
            checked={table.isSelected(key())}
            class="size-4 accent-primary"
            onChange={() => table.toggleRow(key())}
          />
        </td>
      </Show>
      <For each={table.columns()}>
        {(column) => (
          <td class={cn("px-3 py-2 align-middle", column.cellClass ?? column.class)}>
            {column.cell ? column.cell(row()) : text(column.accessor(row()))}
          </td>
        )}
      </For>
    </tr>
  );
}

function TableFoot(): JSX.Element {
  const table = useTable<unknown>();

  return (
    <Show when={table.pageSize() > 0}>
      <tfoot data-slot="table-data-foot" class="border-t bg-muted/50 font-medium">
        <tr>
          <td colspan={table.columns().length + 1} class="p-2">
            <TablePagination />
          </td>
        </tr>
      </tfoot>
    </Show>
  );
}

export function TablePagination(): JSX.Element {
  const table = useTable<unknown>();
  const page = () => table.page();
  const count = () => table.pageCount();

  return (
    <div data-slot="table-data-pagination" class="flex items-center justify-end gap-2 text-sm">
      <button
        type="button"
        data-slot="table-data-previous"
        aria-label="Previous page"
        disabled={page() <= 0}
        class="inline-flex h-8 items-center justify-center rounded-md border px-3 disabled:pointer-events-none disabled:opacity-50"
        onClick={() => table.setPage(Math.max(0, page() - 1))}
      >
        Previous
      </button>
      <span class="tabular-nums">
        Page {page() + 1} of {count()}
      </span>
      <button
        type="button"
        data-slot="table-data-next"
        aria-label="Next page"
        disabled={page() >= count() - 1}
        class="inline-flex h-8 items-center justify-center rounded-md border px-3 disabled:pointer-events-none disabled:opacity-50"
        onClick={() => table.setPage(Math.min(count() - 1, page() + 1))}
      >
        Next
      </button>
    </div>
  );
}