import type { JSX } from "@solidjs/web";
import { For, Show, createContext, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * Carousel — a set of slides with previous/next controls and dots.
 *
 * ```tsx
 * <Carousel orientation="horizontal" opts={{ loop: true }}>
 *   <CarouselContent>
 *     <CarouselItem>…</CarouselItem>
 *     <CarouselItem>…</CarouselItem>
 *   </CarouselContent>
 *   <CarouselPrevious />
 *   <CarouselNext />
 * </Carousel>
 * ```
 *
 * Embla drives this in shadcn, and the reason to know that is that Embla is a
 * **dependency you inherit** — the `Carousel` component cannot be a copied
 * file if it needs a package. What is here instead is the part Embla was
 * providing that a component cannot invent: the state machine. `prev` and
 * `next` stop at the ends unless `loop` is on, selecting an out-of-range dot
 * does not go out of range, and the buttons disable themselves when there is
 * nowhere to go.
 *
 * What it deliberately does not do is drag-to-scroll and transform syncing.
 * Those are the parts Embla actually earns its keep on, and faking them
 * usually ends up worse than not having them. Add `embla-carousel-solid` and
 * wire its API into this component if you need them — the props are already
 * shaped to make that a small change.
 */

export interface CarouselOptions {
  /** Wrap from the last slide to the first. */
  loop?: boolean;
  /** Slides shown at once. `1` by default. */
  slidesToShow?: number;
  /** Gap between slides, in pixels. Not read by this implementation. */
  gap?: number;
}

interface CarouselContextValue {
  index: () => number;
  count: () => number;
  scrollTo: (index: number) => void;
  next: () => void;
  previous: () => void;
  canScrollNext: () => boolean;
  canScrollPrev: () => boolean;
  orientation: () => "horizontal" | "vertical";
  /** Count a mounted slide. Called by each `CarouselItem`. */
  register: () => void;
}

const CarouselContext = createContext<CarouselContextValue>();

function useCarousel(): CarouselContextValue {
  const context = useContext(CarouselContext);
  if (!context) throw new Error("Carousel parts must be used inside a <Carousel>.");
  return context;
}

export interface CarouselProps {
  /** Controlled slide index. Omit for an uncontrolled carousel. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  opts?: CarouselOptions;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function Carousel(props: CarouselProps): JSX.Element {
  const [local, rest] = split(props, [
    "index",
    "defaultIndex",
    "onIndexChange",
    "orientation",
    "opts",
    "class",
    "children",
  ]);

  const isControlled = () => local.index !== undefined;
  const [uncontrolled, setUncontrolled] = createSignal(local.defaultIndex ?? 0);
  const index = (): number => (isControlled() ? (local.index ?? 0) : uncontrolled());

  // Registered by `CarouselItem` as each slide mounts, which is what lets a
  // carousel of a generated list size itself without being told the count.
  const [count, setCount] = createSignal(0);

  const loop = () => local.opts?.loop ?? false;
  const perView = () => Math.max(1, local.opts?.slidesToShow ?? 1);

  /** The last reachable index — `count - 1` without loop, `-1` with. */
  const last = (): number => (loop() ? count() - 1 : Math.max(0, count() - perView()));

  const setIndex = (next: number) => {
    const bounded = next < 0 ? (loop() ? count() + next : 0) : next > last() ? (loop() ? next - count() : last()) : next;

    const clamped = Math.min(Math.max(bounded, 0), Math.max(0, last()));
    if (!isControlled()) setUncontrolled(clamped);
    local.onIndexChange?.(clamped);
  };

  const canScrollNext = () => loop() || index() < last();
  const canScrollPrev = () => loop() || index() > 0;

  const orientation = () => local.orientation ?? "horizontal";

  const context: CarouselContextValue = {
    index,
    count,
    scrollTo: setIndex,
    next: () => setIndex(index() + 1),
    previous: () => setIndex(index() - 1),
    canScrollNext,
    canScrollPrev,
    orientation,
    // Slides register as they mount, so a carousel built from generated
    // content sizes itself. `register` is called during `CarouselItem`'s body,
    // so the count is right from the first render rather than after an effect.
    register: () => setCount((previous) => previous + 1),
  };

  return (
    <CarouselContext value={context}>
      <div
        data-slot="carousel"
        role="region"
        aria-roledescription="carousel"
        data-orientation={orientation()}
        class={cn("relative", local.class)}
        {...rest}
      >
        {local.children}
      </div>
    </CarouselContext>
  );
}

interface PartProps {
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function CarouselContent(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const carousel = useCarousel();

  return (
    <div
      data-slot="carousel-content"
      class={cn("overflow-hidden", local.class)}
      onKeyDown={(event) => {
        const forward = carousel.orientation() === "horizontal" ? "ArrowRight" : "ArrowDown";
        const backward = carousel.orientation() === "horizontal" ? "ArrowLeft" : "ArrowUp";

        if (event.key === forward) {
          event.preventDefault();
          carousel.next();
        }
        if (event.key === backward) {
          event.preventDefault();
          carousel.previous();
        }
      }}
      {...rest}
    >
      <div
        data-slot="carousel-track"
        data-orientation={carousel.orientation()}
        class={cn(
          "flex transition-transform duration-300 ease-out",
          carousel.orientation() === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
        )}
        // The track moves as a fraction of its own width per slide, so the
        // offset is a percentage rather than a measured pixel count — which
        // keeps it correct through a resize without a ResizeObserver.
        style={{ "--carousel-offset": `${carousel.index() * (100 / Math.max(1, carousel.count()))}%` }}
      >
        {local.children}
      </div>
    </div>
  );
}

export function CarouselItem(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const carousel = useCarousel();

  // Counted on mount so the carousel sizes itself from its children.
  carousel.register();

  return (
    <div
      data-slot="carousel-item"
      role="group"
      aria-roledescription="slide"
      data-orientation={carousel.orientation()}
      class={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        carousel.orientation() === "horizontal" ? "pl-4" : "pt-4",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
}

function ArrowIcon(props: { direction: "left" | "right" }): JSX.Element {
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
      class="size-4"
    >
      <path d={props.direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

interface ButtonProps extends PartProps {
  disabled?: boolean;
}

export function CarouselPrevious(props: ButtonProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled"]);
  const carousel = useCarousel();

  const disabled = () => local.disabled ?? !carousel.canScrollPrev();

  return (
    <button
      type="button"
      data-slot="carousel-previous"
      aria-label="Previous slide"
      // Disabled rather than inert, so the state is legible — and so a screen
      // reader can say "end of carousel" instead of nothing at all.
      disabled={disabled()}
      class={cn(
        "absolute top-1/2 -left-12 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        local.class,
      )}
      onClick={carousel.previous}
      {...rest}
    >
      {local.children ?? <ArrowIcon direction="left" />}
    </button>
  );
}

export function CarouselNext(props: ButtonProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children", "disabled"]);
  const carousel = useCarousel();

  const disabled = () => local.disabled ?? !carousel.canScrollNext();

  return (
    <button
      type="button"
      data-slot="carousel-next"
      aria-label="Next slide"
      disabled={disabled()}
      class={cn(
        "absolute top-1/2 -right-12 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-sm",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        "disabled:pointer-events-none disabled:opacity-50",
        local.class,
      )}
      onClick={carousel.next}
      {...rest}
    >
      {local.children ?? <ArrowIcon direction="right" />}
    </button>
  );
}

export function CarouselDots(props: PartProps): JSX.Element {
  const [local, rest] = split(props, ["class", "children"]);
  const carousel = useCarousel();

  return (
    <div data-slot="carousel-dots" class={cn("mt-2 flex items-center justify-center gap-2", local.class)} {...rest}>
      <For each={Array.from({ length: carousel.count() }, (_, index) => index)}>
        {(index) => (
          <button
            data-slot="carousel-dot"
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={carousel.index() === index ? "true" : undefined}
            class={cn(
              "size-2 rounded-full transition-colors",
              carousel.index() === index ? "bg-primary" : "bg-muted",
            )}
            onClick={() => carousel.scrollTo(index)}
          />
        )}
      </For>
    </div>
  );
}