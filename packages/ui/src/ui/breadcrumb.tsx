import { Show, type JSX, splitProps } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";

type Part = {
  class?: string;
  children?: JSX.Element;
  "aria-label"?: string;
  [key: string]: unknown;
};

/** Right-pointing chevron between crumbs. Inline so the component has no icon dependency. */
function ChevronRight(): JSX.Element {
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
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MoreHorizontal(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

/**
 * The trail of ancestors for the current page.
 *
 * ```tsx
 * <Breadcrumb>
 *   <BreadcrumbList>
 *     <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
 *     <BreadcrumbSeparator />
 *     <BreadcrumbItem><BreadcrumbPage>Settings</BreadcrumbPage></BreadcrumbItem>
 *   </BreadcrumbList>
 * </Breadcrumb>
 * ```
 *
 * Separators and the ellipsis carry `aria-hidden`, so a screen reader hears
 * "Home, Settings" rather than "Home, chevron, Settings".
 */
export function Breadcrumb(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "aria-label"]);
  return (
    <nav
      data-slot="breadcrumb"
      aria-label={local["aria-label"] ?? "breadcrumb"}
      class={local.class}
      {...rest}
    />
  );
}

export function BreadcrumbList(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ol
      data-slot="breadcrumb-list"
      class={cn(
        "flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5",
        local.class,
      )}
      {...rest}
    />
  );
}

export function BreadcrumbItem(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <li
      data-slot="breadcrumb-item"
      class={cn("inline-flex items-center gap-1.5", local.class)}
      {...rest}
    />
  );
}

/**
 * A crumb that links somewhere.
 *
 * `asChild` keeps the router's own link component: `<BreadcrumbLink asChild>`
 * wrapping `<A href="/projects">Projects</A>`.
 */
export function BreadcrumbLink(props: Part & { asChild?: boolean }): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "asChild", "children"]);
  const attributes = () => ({
    "data-slot": "breadcrumb-link",
    class: cn("transition-colors hover:text-foreground", local.class),
  });

  return props.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <a {...attributes()} {...rest}>
          {local.children}
        </a>
      );
}

/** The current page: not a link, and announced as current. */
export function BreadcrumbPage(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      class={cn("font-normal text-foreground", local.class)}
      {...rest}
    />
  );
}

export function BreadcrumbSeparator(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      class={cn("[&>svg]:size-3.5", local.class)}
      {...rest}
    >
      <Show when={local.children} fallback={<ChevronRight />}>
        {local.children}
      </Show>
    </li>
  );
}

/** Stands in for collapsed crumbs. The label stays out of the announcement. */
export function BreadcrumbEllipsis(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      class={cn("flex size-9 items-center justify-center", local.class)}
      {...rest}
    >
      <MoreHorizontal />
      <span class="sr-only">More</span>
    </span>
  );
}
