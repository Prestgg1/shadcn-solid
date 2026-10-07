import type { JSX } from "@solidjs/web";
import { For, createContext, createUniqueId, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * Chart — a themed chart container, with SVG primitives for the parts a chart
 * is actually made of.
 *
 * ```tsx
 * <ChartContainer config={config} class="h-64 w-full">
 *   <ChartLine data={data} series="revenue" />
 * </ChartContainer>
 * ```
 *
 * **This is not Recharts.** shadcn's `chart` wraps Recharts, which is an
 * 800 kB dependency that a copied-in component cannot be free of. What is
 * here is the other half of what makes shadcn's version worth copying: the
 * theming. A chart's colours have to come from the design tokens so a chart
 * matches the rest of the app in dark mode, and shadcn solves that by
 * mapping each series onto a CSS variable.
 *
 * That mapping is kept verbatim — `config` is the same shape, `--color-N`
 * is the same convention, `ChartStyle` still injects the custom properties —
 * so migrating to a charting library later is a matter of replacing the
 * drawing primitives, not of restyling every chart.
 *
 * The drawing is SVG and scales with the container. There is no animation, no
 * legend, no axes component: those belong to whichever library you pick.
 */

export type ChartConfig = Record<
  string,
  {
    label: string;
    /** A CSS colour, usually `var(--color-x)`. */
    color?: string;
    theme?: "light" | "dark";
  }
>;

interface ChartContextValue {
  config: () => ChartConfig;
}

const ChartContext = createContext<ChartContextValue>();

function useChart(): ChartContextValue {
  const context = useContext(ChartContext);
  if (!context) throw new Error("Chart parts must be used inside a <ChartContainer>.");
  return context;
}

export interface ChartContainerProps {
  /** Series definitions: labels and colours, keyed by series name. */
  config: ChartConfig;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

export function ChartContainer(props: ChartContainerProps): JSX.Element {
  const [local, rest] = split(props, ["config", "class", "children"]);

  // The variables `ChartStyle` writes are scoped to `[data-chart="<id>"]`,
  // so the container has to carry the same id — that is what stops two
  // charts on a page from redefining each other's colours.
  const id = createUniqueId();

  return (
    <ChartContext value={{ config: () => local.config }}>
      <div
        data-slot="chart"
        data-chart={id}
        class={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.chart-grid_line]:stroke-border/50",
          "[&_.chart-label]:fill-muted-foreground",
          local.class,
        )}
        {...rest}
      >
        <ChartStyle config={local.config} id={id} />
        {local.children}
      </div>
    </ChartContext>
  );
}

/**
 * Injects the custom properties the series colours resolve through.
 *
 * Rendered as a `<style>` rather than inline styles because the variables have
 * to be readable from SVG `stroke` attributes and from CSS selectors alike —
 * `var(--color-revenue)` works in both, an inline style on one element does
 * not.
 */
export function ChartStyle(props: { config: ChartConfig; id?: string }): JSX.Element {
  const generated = createUniqueId();
  const id = () => props.id ?? generated;

  const colours = () =>
    Object.entries(props.config)
      .filter(([, entry]) => entry.color)
      .map(([key, entry]) => `  --color-${key}: ${entry.color};`)
      .join("\n");

  return (
    <style
      data-slot="chart-style"
      // Scoped by id so two charts on a page cannot redefine each other's
      // variables — the usual failure of a global `<style>`.
      id={id()}
      innerHTML={`[data-chart="${id()}"] {\n${colours()}\n}`}
    />
  );
}

/** The scalable box the series are drawn inside. */
export function ChartSvg(props: { class?: string; children?: JSX.Element; viewBox?: string }): JSX.Element {
  const [local] = split(props, ["class", "children", "viewBox"]);

  return (
    <svg
      data-slot="chart-svg"
      role="img"
      viewBox={local.viewBox ?? "0 0 100 100"}
      preserveAspectRatio="none"
      class={cn("h-full w-full overflow-visible", local.class)}
    >
      {local.children}
    </svg>
  );
}

/** One data point. `x` and `y` are in the `viewBox`'s units, not pixels. */
export interface ChartDatum {
  label: string;
  value: number;
}

interface SeriesProps {
  data: ChartDatum[];
  /** Which entry of `config` to colour it from. */
  series: string;
  /** Draw a filled area under the line. */
  fill?: boolean;
  strokeWidth?: number;
  class?: string;
}

/**
 * Turn data into a polyline.
 *
 * The scale is fixed at the 0–100 of the default `viewBox`, so a chart is
 * drawn in its own coordinate space and scales with the container instead of
 * needing to be measured. A caller who needs different bounds passes their own
 * `viewBox` to `ChartSvg` and their own `toY`.
 */
function useSeries(props: SeriesProps) {
  const chart = useChart();

  const points = () => {
    const data = props.data;
    if (data.length === 0) return "";

    const max = Math.max(...data.map((point) => point.value), 1);
    const step = data.length === 1 ? 100 : 100 / (data.length - 1);

    return data
      .map((point, index) => `${(index * step).toFixed(3)},${(100 - (point.value / max) * 100).toFixed(3)}`)
      .join(" ");
  };

  const area = () => {
    const line = points();
    if (line === "") return "";
    return `0,100 ${line} 100,100`;
  };

  const colour = () => chart.config()[props.series]?.color ?? "currentColor";

  return { points, area, colour };
}

export function ChartLine(props: SeriesProps): JSX.Element {
  const series = useSeries(props);

  return (
    <polyline
      data-slot="chart-line"
      data-series={props.series}
      points={series.points()}
      fill="none"
      stroke={series.colour()}
      stroke-width={props.strokeWidth ?? 2}
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
      class={cn(props.class)}
    />
  );
}

export function ChartArea(props: SeriesProps): JSX.Element {
  const series = useSeries(props);

  return (
    <polygon
      data-slot="chart-area"
      data-series={props.series}
      points={series.area()}
      fill={series.colour()}
      fill-opacity="0.15"
      stroke="none"
      class={cn(props.class)}
    />
  );
}

/** A labelled reference line, for a target or a threshold. */
export function ChartReferenceLine(props: { y: number; label?: string; class?: string }): JSX.Element {
  const [local] = split(props, ["y", "label", "class"]);

  return (
    <line
      data-slot="chart-reference-line"
      x1="0"
      x2="100"
      y1={local.y}
      y2={local.y}
      stroke="currentColor"
      stroke-opacity="0.3"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
      class={cn("text-muted-foreground", local.class)}
    />
  );
}

export interface ChartTooltipProps {
  /** Which point to describe. */
  point: ChartDatum;
  series: string;
  class?: string;
}

export function ChartTooltipContent(props: ChartTooltipProps): JSX.Element {
  const chart = useChart();

  return (
    <div
      data-slot="chart-tooltip"
      role="tooltip"
      class={cn(
        "rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md",
        props.class,
      )}
    >
      <div class="text-muted-foreground">{props.point.label}</div>
      <div class="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          class="size-2 shrink-0 rounded-[2px]"
          style={{ background: chart.config()[props.series]?.color ?? "currentColor" }}
        />
        {chart.config()[props.series]?.label ?? props.series}
        <span class="ml-auto tabular-nums">{props.point.value}</span>
      </div>
    </div>
  );
}

/** A key for the series in a chart. */
export function ChartLegend(props: { class?: string }): JSX.Element {
  const [local] = split(props, ["class"]);
  const chart = useChart();

  return (
    <div data-slot="chart-legend" class={cn("flex flex-wrap items-center gap-4", local.class)}>
      <For each={Object.entries(chart.config())}>
        {([key, entry]) => (
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              class="size-2 shrink-0 rounded-[2px]"
              style={{ background: entry.color ?? "currentColor" }}
            />
            {entry.label}
            <span class="sr-only">{key}</span>
          </div>
        )}
      </For>
    </div>
  );
}
