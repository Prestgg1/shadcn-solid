import type { JSX } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/lib/cn";
import { asChild } from "~/lib/slot";
import { variants } from "~/lib/variants";
import { Separator } from "./separator";

type Part = { class?: string; children?: JSX.Element; [key: string]: unknown };

const itemVariants = variants(
  "group/item flex flex-wrap items-center rounded-md border border-transparent text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-accent/50",
  {
    variants: {
      variant: { default: "bg-transparent", outline: "border-border", muted: "bg-muted/50" },
      size: { default: "gap-4 p-4", sm: "gap-2.5 px-4 py-3" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const itemMediaVariants = variants(
  "flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-8 rounded-sm border bg-muted [&_svg:not([class*='size-'])]:size-4",
        image: "size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

/**
 * One row of a list: media, text, actions.
 *
 * ```tsx
 * <ItemGroup>
 *   <Item>
 *     <ItemMedia variant="image"><img src={doc.cover} alt="" /></ItemMedia>
 *     <ItemContent>
 *       <ItemHeader>
 *         <ItemTitle>{doc.title}</ItemTitle>
 *         <ItemActions><Button size="icon-xs" variant="ghost"><MoreIcon /></Button></ItemActions>
 *       </ItemHeader>
 *       <ItemDescription>{doc.summary}</ItemDescription>
 *     </ItemContent>
 *   </Item>
 *   <ItemSeparator />
 * </ItemGroup>
 * ```
 *
 * A list of rows that all look alike and mostly get read, not clicked. For
 * rows that navigate, use `asChild` on `Item` to make the row the link.
 */
export function Item(props: Part & { variant?: "default" | "outline" | "muted"; size?: "default" | "sm"; asChild?: boolean }): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "variant", "size", "asChild", "children"]);
  const variant = () => local.variant ?? "default";
  const size = () => local.size ?? "default";

  const attributes = () => ({
    "data-slot": "item",
    "data-variant": variant(),
    "data-size": size(),
    class: itemVariants({ variant: variant(), size: size(), class: local.class }),
  });

  return props.asChild
    ? asChild(() => local.children ?? null, attributes)
    : (
        <div {...attributes()} {...rest}>
          {local.children}
        </div>
      );
}

/** The list container. */
export function ItemGroup(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      role="list"
      data-slot="item-group"
      class={cn("group/item-group flex flex-col", local.class)}
      {...rest}
    />
  );
}

/** A rule between two items. */
export function ItemSeparator(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      class={cn("my-0", local.class)}
      {...rest}
    />
  );
}

/** Leading icon, avatar or thumbnail. */
export function ItemMedia(props: Part & { variant?: "default" | "icon" | "image" }): JSX.Element {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <div
      data-slot="item-media"
      data-variant={local.variant ?? "default"}
      class={cn(itemMediaVariants({ variant: local.variant }), local.class)}
      {...rest}
    />
  );
}

/** The text column. A second `ItemContent` in the same row collapses, so a meta block can follow. */
export function ItemContent(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="item-content"
      class={cn("flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none", local.class)}
      {...rest}
    />
  );
}

/** A full-width row for a title and its actions. */
export function ItemHeader(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="item-header"
      class={cn("flex basis-full items-center justify-between gap-2", local.class)}
      {...rest}
    />
  );
}

/** A full-width row for secondary detail under the title. */
export function ItemFooter(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="item-footer"
      class={cn("flex basis-full items-center justify-between gap-2", local.class)}
      {...rest}
    />
  );
}

export function ItemTitle(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="item-title"
      class={cn("flex w-fit items-center gap-2 text-sm leading-snug font-medium", local.class)}
      {...rest}
    />
  );
}

export function ItemDescription(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <p
      data-slot="item-description"
      class={cn(
        "line-clamp-2 text-sm leading-normal font-normal text-balance text-muted-foreground",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        local.class,
      )}
      {...rest}
    />
  );
}

export function ItemActions(props: Part): JSX.Element {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div data-slot="item-actions" class={cn("flex items-center gap-2", local.class)} {...rest} />
  );
}

export { itemVariants, itemMediaVariants };
