import type { JSX } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";

export interface TableProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A data table.
 *
 * ```tsx
 * <Table>
 *   <TableHeader><TableRow><TableHead>Name</TableHead></TableRow></TableHeader>
 *   <TableBody><TableRow><TableCell>Ada</TableCell></TableRow></TableBody>
 * </Table>
 * ```
 *
 * `Table` wraps the `<table>` in a scroll container, so a wide table scrolls
 * inside its card instead of breaking the page layout.
 */
export function Table(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <div data-slot="table-container" class="relative w-full overflow-x-auto">
      <table data-slot="table" class={cn("w-full caption-bottom text-sm", local.class)} {...rest} />
    </div>
  );
}

export function TableHeader(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return <thead data-slot="table-header" class={cn("[&_tr]:border-b", local.class)} {...rest} />;
}

export function TableBody(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <tbody data-slot="table-body" class={cn("[&_tr:last-child]:border-0", local.class)} {...rest} />
  );
}

export function TableFooter(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <tfoot
      data-slot="table-footer"
      class={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", local.class)}
      {...rest}
    />
  );
}

/**
 * One row.
 *
 * `data-state="selected"` styles the row as chosen; use it alongside a
 * checkbox in the first cell so the visual and the state agree.
 */
export function TableRow(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <tr
      data-slot="table-row"
      class={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        local.class,
      )}
      {...rest}
    />
  );
}

export function TableHead(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <th
      data-slot="table-head"
      class={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        local.class,
      )}
      {...rest}
    />
  );
}

export function TableCell(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <td
      data-slot="table-cell"
      class={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        local.class,
      )}
      {...rest}
    />
  );
}

/** A caption describing the table, for screen readers and for the page. */
export function TableCaption(props: TableProps): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <caption data-slot="table-caption" class={cn("mt-4 text-sm text-muted-foreground", local.class)} {...rest} />
  );
}
