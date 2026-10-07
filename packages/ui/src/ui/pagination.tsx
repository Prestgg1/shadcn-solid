import type { JSX } from "@solidjs/web";
import { split } from "~/lib/split";

import { cn } from "~/lib/cn";
import { buttonVariants, type ButtonSize } from "./button";

type Part = { class?: string; children?: JSX.Element; [key: string]: unknown };

/**
 * Page navigation.
 *
 * ```tsx
 * <Pagination>
 *   <PaginationContent>
 *     <PaginationItem><PaginationPrevious href="?page=1" /></PaginationItem>
 *     <PaginationItem><PaginationLink href="?page=2" isActive>2</PaginationLink></PaginationItem>
 *     <PaginationItem><PaginationNext href="?page=3" /></PaginationItem>
 *   </PaginationContent>
 * </Pagination>
 * ```
 *
 * The links are real anchors with `href`, so pages can be opened in a new
 * tab, middle-clicked and crawled. The active page carries `aria-current`.
 */
export function Pagination(props: Part & { "aria-label"?: string }): JSX.Element {
  const [local, rest] = split(props, ["class", "aria-label"]);
  return (
    <nav
      role="navigation"
      aria-label={local["aria-label"] ?? "pagination"}
      data-slot="pagination"
      class={cn("mx-auto flex w-full justify-center", local.class)}
      {...rest}
    />
  );
}

export function PaginationContent(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <ul
      data-slot="pagination-content"
      class={cn("flex flex-row items-center gap-1", local.class)}
      {...rest}
    />
  );
}

export function PaginationItem(props: Part): JSX.Element {
  const [local] = split(props, ["class"]);
  return <li data-slot="pagination-item" class={local.class} />;
}

/** One page. `isActive` styles it as current and sets `aria-current="page"`. */
export function PaginationLink(
  props: Part & { isActive?: boolean; size?: ButtonSize },
): JSX.Element {
  const [local, rest] = split(props, ["class", "isActive", "size"]);

  return (
    <a
      aria-current={local.isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={local.isActive}
      class={cn(
        buttonVariants({
          variant: local.isActive ? "outline" : "ghost",
          size: local.size ?? "icon",
          class: local.class }),
      )}
      {...rest}
    />
  );
}

export function PaginationPrevious(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <a
      aria-label="Go to previous page"
      data-slot="pagination-previous"
      class={cn(buttonVariants({ variant: "ghost", size: "default" }), "gap-1 px-2.5 sm:pl-2.5", local.class)}
      {...rest}
    >
      <span aria-hidden="true">‹</span>
      <span class="hidden sm:block">{local.children ?? "Previous"}</span>
    </a>
  );
}

export function PaginationNext(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  return (
    <a
      aria-label="Go to next page"
      data-slot="pagination-next"
      class={cn(buttonVariants({ variant: "ghost", size: "default" }), "gap-1 px-2.5 sm:pr-2.5", local.class)}
      {...rest}
    >
      <span class="hidden sm:block">{local.children ?? "Next"}</span>
      <span aria-hidden="true">›</span>
    </a>
  );
}

/**
 * Stands in for collapsed page numbers.
 *
 * The label is inside `aria-hidden`, so the count of hidden pages is not
 * announced; the surrounding `<nav>` already carries the context.
 */
export function PaginationEllipsis(props: Part): JSX.Element {
  const [local, rest] = split(props, ["class"]);
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      class={cn("flex size-9 items-center justify-center", local.class)}
      {...rest}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        class="size-4"
      >
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
      <span class="sr-only">More pages</span>
    </span>
  );
}
