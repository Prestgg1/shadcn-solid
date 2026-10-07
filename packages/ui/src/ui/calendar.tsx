import type { JSX } from "@solidjs/web";
import { For, Show, createContext, createMemo, createSignal, useContext } from "solid-js";

import { cn } from "~/lib/cn";
import { split } from "~/lib/split";

/**
 * Calendar — a month grid with keyboard navigation.
 *
 * ```tsx
 * <Calendar mode="single" selected={date()} onSelect={setDate} />
 * ```
 *
 * **Dates are local `Date`s, not strings.** Storing a date as `"2026-10-08"`
 * and parsing it back is how a calendar ends up off by a day for anyone west
 * of UTC — the string has no zone, and `new Date("2026-10-08")` means
 * midnight UTC. Everything here builds dates with `new Date(y, m, d)`, which
 * is local midnight by construction.
 *
 * **The month is the smallest thing that can be right.** No view switcher, no
 * year grid, no range drag. Those belong to a date-picker, and the pieces
 * here compose: a month grid, and a trigger that shows the formatted month.
 */

export type CalendarMode = "single" | "multiple";

export interface CalendarProps {
  /** The month to show, as any date inside it. Defaults to today. */
  month?: Date;
  defaultMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** `mode="single"` takes a date; `mode="multiple"` takes a list. */
  mode?: CalendarMode;
  selected?: Date | Date[];
  defaultSelected?: Date | Date[];
  onSelect?: (value: Date | Date[] | undefined) => void;
  /** Days before this are not selectable. */
  disabled?: (date: Date) => boolean;
  /** Days that cannot be selected at all. */
  disabledDays?: Date[];
  /** Weeks start on Monday rather than Sunday. */
  weekStartsOn?: 0 | 1;
  locale?: string;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

interface CalendarContextValue {
  month: () => Date;
  setMonth: (month: Date) => void;
  today: () => Date;
  isSelected: (date: Date) => boolean;
  isDisabled: (date: Date) => boolean;
  select: (date: Date) => void;
  isOutside: (date: Date) => boolean;
  weekStartsOn: () => 0 | 1;
  todayDate: Date;
}

const CalendarContext = createContext<CalendarContextValue>();

function useCalendar(): CalendarContextValue {
  const context = useContext(CalendarContext);
  if (!context) throw new Error("Calendar parts must be used inside a <Calendar>.");
  return context;
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * The first of the month `months` away.
 *
 * Day 1, deliberately: the day of month is irrelevant to a month grid, and
 * carrying it is what makes stepping from 31 December land back on December
 * (31 December plus a month is "the 31st", which does not exist) or from 31
 * January skip February.
 */
const addMonths = (date: Date, months: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

export function Calendar(props: CalendarProps): JSX.Element {
  const [local, rest] = split(props, [
    "month",
    "defaultMonth",
    "onMonthChange",
    "mode",
    "selected",
    "defaultSelected",
    "onSelect",
    "disabled",
    "disabledDays",
    "weekStartsOn",
    "locale",
    "class",
    "children",
  ]);

  const monthControlled = () => local.month !== undefined;
  const [uncontrolledMonth, setUncontrolledMonth] = createSignal<Date>(
    startOfDay(local.defaultMonth ?? new Date()),
  );
  const month = () => startOfDay(monthControlled() ? (local.month ?? new Date()) : uncontrolledMonth());

  const setMonth = (next: Date) => {
    if (!monthControlled()) setUncontrolledMonth(next);
    local.onMonthChange?.(next);
  };

  const selectionControlled = () => local.selected !== undefined;
  const [uncontrolledSelected, setUncontrolledSelected] = createSignal<Date | Date[] | undefined>(
    local.defaultSelected ?? (local.mode === "multiple" ? [] : undefined),
  );
  const selection = () => (selectionControlled() ? local.selected : uncontrolledSelected());

  const isSelected = (date: Date): boolean => {
    const current = selection();
    return Array.isArray(current) ? current.some((entry) => sameDay(entry, date)) : Boolean(current && sameDay(current, date));
  };

  const select = (date: Date) => {
    if (local.mode === "multiple") {
      const current = Array.isArray(selection()) ? (selection() as Date[]) : [];
      const next = isSelected(date)
        ? current.filter((entry) => !sameDay(entry, date))
        : [...current, date];

      if (!selectionControlled()) setUncontrolledSelected(next);
      local.onSelect?.(next);
      return;
    }

    if (!selectionControlled()) setUncontrolledSelected(date);
    local.onSelect?.(date);
  };

  const isDisabled = (date: Date): boolean => {
    const day = startOfDay(date);
    // Explicit days first, then the caller's predicate — so a disabled day
    // cannot be re-enabled by a predicate that does not know about it.
    if ((local.disabledDays ?? []).some((entry) => sameDay(entry, day))) return true;
    return local.disabled?.(day) ?? false;
  };

  const context: CalendarContextValue = {
    month,
    setMonth,
    today: () => startOfDay(new Date()),
    isSelected,
    isDisabled,
    select,
    isOutside: (date) => date.getMonth() !== month().getMonth(),
    weekStartsOn: () => local.weekStartsOn ?? 0,
    todayDate: startOfDay(new Date()),
  };

  return (
    <CalendarContext value={context}>
      <div
        data-slot="calendar"
        class={cn("w-fit rounded-md border bg-background p-3", local.class)}
        {...rest}
      >
        <CalendarHeader />
        <CalendarGrid />
        {local.children}
      </div>
    </CalendarContext>
  );
}

function CalendarHeader(): JSX.Element {
  return (
    <div data-slot="calendar-header" class="relative flex items-center justify-center pb-2">
      <CalendarPrevious />
      <CalendarCaption />
      <CalendarNext />
    </div>
  );
}

/** The month and year, as a heading over the grid. */
function CalendarCaption(): JSX.Element {
  const calendar = useCalendar();

  const label = () =>
    calendar
      .month()
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div
      data-slot="calendar-caption"
      // A live heading: changing month must say so, or a screen reader user
      // cannot tell the grid moved.
      aria-live="polite"
      class="text-sm font-medium"
    >
      {label()}
    </div>
  );
}

export function CalendarPrevious(): JSX.Element {
  const calendar = useCalendar();

  return (
    <button
      data-slot="calendar-previous"
      type="button"
      aria-label="Previous month"
      class="absolute left-1 inline-flex size-7 items-center justify-center rounded-md opacity-50 hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={() => calendar.setMonth(addMonths(calendar.month(), -1))}
    >
      <Chevron direction="left" />
    </button>
  );
}

export function CalendarNext(): JSX.Element {
  const calendar = useCalendar();

  return (
    <button
      data-slot="calendar-next"
      type="button"
      aria-label="Next month"
      class="absolute right-1 inline-flex size-7 items-center justify-center rounded-md opacity-50 hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={() => calendar.setMonth(addMonths(calendar.month(), 1))}
    >
      <Chevron direction="right" />
    </button>
  );
}

function Chevron(props: { direction: "left" | "right" }): JSX.Element {
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

function CalendarGrid(): JSX.Element {
  const calendar = useCalendar();

  /**
   * Six weeks of seven days, starting on the week that contains the 1st.
   *
   * Always 42 cells: a month whose grid grew and shrank as you paged between
   * it and the next would move the whole calendar under the pointer, which is
   * a well-known way to make a date picker feel broken.
   */
  const days = createMemo(() => {
    const first = new Date(calendar.month().getFullYear(), calendar.month().getMonth(), 1);

    const lead = (first.getDay() - calendar.weekStartsOn() + 7) % 7;
    const start = addDays(first, -lead);

    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  });

  const weekdayNames = createMemo(() => {
    // 2024-01-07 was a Sunday, so a week of these covers the names in order.
    const sunday = new Date(2024, 0, 7);
    const names: string[] = [];

    for (let i = 0; i < 7; i += 1) {
      const day = addDays(sunday, i + calendar.weekStartsOn());
      names.push(day.toLocaleDateString(undefined, { weekday: "short" }));
    }

    return names;
  });

  return (
    <div data-slot="calendar-grid" role="grid" class="w-full">
      <div role="row" class="flex">
        <For each={weekdayNames()}>
          {(name) => (
            <div
              role="columnheader"
              // The visible name is "Sun"; `aria-label` carries the full one,
              // because "Sun" alone is ambiguous once a grid spans two months.
              aria-label={name}
              class="w-9 text-center text-[0.8rem] font-normal text-muted-foreground"
            >
              {name}
            </div>
          )}
        </For>
      </div>

      <For each={chunk(days(), 7)}>
        {(week) => (
          <div role="row" class="flex w-full">
            <For each={week}>{(day) => <CalendarDay day={day} />}</For>
          </div>
        )}
      </For>
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function CalendarDay(props: { day: Date }): JSX.Element {
  const calendar = useCalendar();

  const day = () => props.day;
  const outside = () => calendar.isOutside(day());
  const selected = () => calendar.isSelected(day());
  const disabled = () => calendar.isDisabled(day());
  const isToday = () => sameDay(day(), calendar.todayDate);

  return (
    <div role="gridcell" class="p-0 text-center">
      <button
        data-slot="calendar-day"
        type="button"
        data-outside={outside() ? "" : undefined}
        data-selected={selected() ? "" : undefined}
        data-today={isToday() ? "" : undefined}
        disabled={disabled()}
        // The full date, not the day number: "8" on its own is ambiguous the
        // moment a grid shows two months.
        aria-label={day().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        aria-pressed={selected() ? "true" : undefined}
        aria-current={isToday() ? "date" : undefined}
        class={cn(
          "inline-flex size-9 items-center justify-center rounded-md text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "data-[outside]:text-muted-foreground/50",
          "data-[today]:border data-[today]:border-input",
          "data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:hover:bg-primary",
          "disabled:pointer-events-none disabled:opacity-30",
        )}
        onClick={() => calendar.select(day())}
      >
        {day().getDate()}
      </button>
    </div>
  );
}

export interface CalendarDayButtonProps {
  /** A `Date` inside the day this button stands for. */
  day: Date;
  modifiers?: JSX.Element;
  class?: string;
}

/** One day on its own, for a custom trigger: `<CalendarDayButton day={date} />`. */
export function CalendarDayButton(props: CalendarDayButtonProps): JSX.Element {
  const [local] = split(props, ["day", "modifiers", "class"]);
  const calendar = useCalendar();

  const day = () => local.day;
  const selected = () => calendar.isSelected(day());

  return (
    <button
      data-slot="calendar-day-button"
      data-selected={selected() ? "" : undefined}
      disabled={calendar.isDisabled(day())}
      aria-label={day().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
      aria-pressed={selected() ? "true" : undefined}
      class={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-sm",
        "data-[selected]:bg-primary data-[selected]:text-primary-foreground",
        local.class,
      )}
      onClick={() => calendar.select(day())}
    >
      <Show when={local.modifiers} fallback={day().getDate()}>
        {local.modifiers}
      </Show>
    </button>
  );
}

export interface CalendarTriggerProps {
  /** The month the trigger opens at. */
  month?: Date;
  class?: string;
  children?: JSX.Element;
  [key: string]: unknown;
}

/** A button that shows the month; put a `Calendar` beside it to open. */
export function CalendarTrigger(props: CalendarTriggerProps): JSX.Element {
  const [local, rest] = split(props, ["month", "class", "children"]);

  const label = () =>
    (local.month ?? new Date()).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <button
      data-slot="calendar-trigger"
      type="button"
      class={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        local.class,
      )}
      {...rest}
    >
      {local.children ?? label()}
    </button>
  );
}

/** Human-readable date, for a trigger that shows one rather than a month. */
export function formatDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}
