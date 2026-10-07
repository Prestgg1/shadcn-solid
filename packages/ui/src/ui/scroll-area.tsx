import type { JSX } from "@solidjs/web";
import { Show, createSignal, onSettled } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

export interface ScrollAreaProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/**
 * A scrollable region with a styled scrollbar.
 *
 * ```tsx
 * <ScrollArea class="h-40">
 *   {rows}
 * </ScrollArea>
 * ```
 *
 * There is no `overflow` on the outer element — the inner viewport scrolls and
 * reports its offset, so the bars can be styled per axis without the
 * cross-axis scrollbar a plain `overflow: auto` produces.
 */
export function ScrollArea(props: ScrollAreaProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);

  let viewport!: HTMLDivElement; // eslint-disable-line no-unassigned-vars -- assigned by the ref below
  const [scrollsX, setScrollsX] = createSignal(false);
  const [scrollsY, setScrollsY] = createSignal(false);
  const [offsetX, setOffsetX] = createSignal(0);
  const [offsetY, setOffsetY] = createSignal(0);

  onSettled(() => {
    const element = viewport;
    if (!element) return;

    const measure = () => {
      setScrollsX(element.scrollWidth > element.clientWidth + 1);
      setScrollsY(element.scrollHeight > element.clientHeight + 1);
      setOffsetX(element.scrollLeft);
      setOffsetY(element.scrollTop);
    };

    measure();

    // A ResizeObserver rather than a one-off measurement: a scrollbar that
    // appears after content loads would otherwise stay invisible.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);

    element.addEventListener("scroll", measure, { passive: true });

    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  });

  return (
    <div
      data-slot="scroll-area"
      class={cn("relative", local.class)}
      dir="ltr"
      {...rest}
    >
      <div
        ref={viewport}
        data-slot="scroll-area-viewport"
        data-scrollable-x={scrollsX() ? "" : undefined}
        data-scrollable-y={scrollsY() ? "" : undefined}
        // Browsers make an overflowing region focusable on their own, but
        // only once it overflows — which is exactly when the user needs
        // keyboard scrolling. Setting it explicitly means the tab stop is
        // there from the first render instead of popping in later.
        tabindex={scrollsX() || scrollsY() ? 0 : undefined}
        class="size-full overflow-hidden rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {local.children}
      </div>

      <ScrollBar
        orientation="vertical"
        visible={scrollsY()}
        offset={offsetY()}
        viewport={viewport}
      />
      <ScrollBar
        orientation="horizontal"
        visible={scrollsX()}
        offset={offsetX()}
        viewport={viewport}
      />

      {/* A corner appears when both bars do, so they do not overlap. */}
      <Show when={scrollsX() && scrollsY()}>
        <div
          data-slot="scroll-area-corner"
          class="absolute right-0 bottom-0 size-2.5 bg-muted"
        />
      </Show>
    </div>
  );
}

interface ScrollBarProps {
  orientation: "vertical" | "horizontal";
  visible: boolean;
  offset: number;
  viewport: HTMLDivElement;
}

/**
 * A scrollbar drawn as a thumb.
 *
 * The size is the viewport's ratio of visible to total content, and the
 * position is a percentage — which is what lets it behave like a real bar
 * without measuring pixels twice.
 */
function ScrollBar(props: ScrollBarProps): JSX.Element {
  const thumb = () => {
    const viewport = props.viewport;
    const vertical = props.orientation === "vertical";

    const client = vertical ? viewport.clientHeight : viewport.clientWidth;
    const scroll = vertical ? viewport.scrollHeight : viewport.scrollWidth;
    const max = Math.max(1, scroll - client);

    const ratio = client / scroll;
    const travel = (max / scroll) * 100;
    const position = (props.offset / max) * travel;

    return vertical
      ? `height: ${ratio * 100}%; transform: translateY(${position}%)`
      : `width: ${ratio * 100}%; transform: translateX(${position}%)`;
  };

  return (
    <Show when={props.visible}>
      <div
        data-slot="scroll-area-scrollbar"
        data-orientation={props.orientation}
        class={cn(
          "flex touch-none select-none p-px transition-colors",
          props.orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
          props.orientation === "horizontal" && "h-2.5 w-full border-t border-t-transparent",
        )}
      >
        <div
          data-slot="scroll-area-thumb"
          data-orientation={props.orientation}
          class="relative flex-1 rounded-full bg-border"
        >
          <div
            class="absolute rounded-full bg-border transition-[color,box-shadow] hover:bg-ink-3"
            style={thumb()}
          />
        </div>
      </div>
    </Show>
  );
}
