import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import { Calendar, CalendarDayButton, CalendarTrigger, formatDate } from "./calendar";

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

const days = () => document.querySelectorAll<HTMLElement>('[data-slot="calendar-day"]');

/** Local midnight on the 15th, so no UTC rounding can shift the test. */
const october = (day = 15) => new Date(2026, 9, day);

describe("Calendar", () => {
  test("renders a 42-cell grid, so paging does not resize it", () => {
    render(() => <Calendar month={october()} />);

    // A month whose grid grew and shrank as you paged would move the whole
    // calendar under the pointer.
    expect(days()).toHaveLength(42);
  });

  test("shows the month it was given", () => {
    render(() => <Calendar month={october()} />);
    expect(slot("calendar-caption")?.textContent).toMatch(/October\s+2026/);
  });

  test("the caption is announced, so paging is perceptible", () => {
    render(() => <Calendar month={october()} />);
    expect(slot("calendar-caption")?.getAttribute("aria-live")).toBe("polite");
  });

  test("marks days from the neighbouring months", () => {
    render(() => <Calendar month={october()} />);

    const outside = Array.from(days()).filter((day) => day.hasAttribute("data-outside"));
    expect(outside.length).toBeGreaterThan(0);
  });

  test("labels a day with its full date, not just the number", () => {
    render(() => <Calendar month={october()} />);

    const label = days()[20]!.getAttribute("aria-label") ?? "";
    // "15" on its own is ambiguous the moment the grid spans two months.
    expect(label).toMatch(/October/);
    expect(label).toMatch(/2026/);
  });

  test("pages forward and back", async () => {
    render(() => <Calendar defaultMonth={october()} />);

    await fireEvent.click(slot("calendar-next")!);
    expect(slot("calendar-caption")?.textContent).toMatch(/November\s+2026/);

    await fireEvent.click(slot("calendar-previous")!);
    expect(slot("calendar-caption")?.textContent).toMatch(/October\s+2026/);
  });

  test("stepping back a month from 31 January lands in December, not February", async () => {
    render(() => <Calendar defaultMonth={new Date(2026, 0, 31)} />);

    await fireEvent.click(slot("calendar-previous")!);
    expect(slot("calendar-caption")?.textContent).toMatch(/December\s+2025/);

    await fireEvent.click(slot("calendar-next")!);
    // Back to January, not December: the day of month is carried nowhere.
    expect(slot("calendar-caption")?.textContent).toMatch(/January\s+2026/);
  });

  test("selecting a day reports the date", async () => {
    let picked: Date | Date[] | undefined;
    render(() => <Calendar month={october()} onSelect={(v) => (picked = v)} />);

    const target = Array.from(days()).find((day) => day.textContent === "15")!;
    await fireEvent.click(target);

    expect(picked).toBeInstanceOf(Date);
    expect((picked as Date).getDate()).toBe(15);
  });

  test("the selected day is marked and pressed", () => {
    render(() => <Calendar month={october()} selected={october(15)} />);

    const selected = Array.from(days()).filter((day) => day.hasAttribute("data-selected"));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toBe("15");
    expect(selected[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  test("multiple mode toggles days rather than replacing one", async () => {
    let picked: Date | Date[] | undefined;
    render(() => <Calendar mode="multiple" month={october()} onSelect={(v) => (picked = v)} />);

    const byText = (text: string) =>
      Array.from(days()).find((day) => day.textContent === text)!;

    await fireEvent.click(byText("15"));
    await fireEvent.click(byText("16"));

    expect(Array.isArray(picked) && picked).toHaveLength(2);
  });

  test("clicking a selected day again deselects it in multiple mode", async () => {
    let picked: Date | Date[] | undefined;
    render(() => <Calendar mode="multiple" month={october()} onSelect={(v) => (picked = v)} />);

    const target = Array.from(days()).find((day) => day.textContent === "15")!;
    await fireEvent.click(target);
    await fireEvent.click(target);

    expect(Array.isArray(picked) ? picked : []).toHaveLength(0);
  });

  test("a disabled day cannot be chosen", async () => {
    let picked: Date | Date[] | undefined;
    render(() => (
      <Calendar month={october()} disabledDays={[october(15)]} onSelect={(v) => (picked = v)} />
    ));

    const target = Array.from(days()).find((day) => day.textContent === "15")!;
    expect(target.hasAttribute("disabled")).toBe(true);

    await fireEvent.click(target);
    expect(picked).toBeUndefined();
  });

  test("a disabled predicate is honoured", () => {
    render(() => <Calendar month={october()} disabled={(date) => date.getDate() > 20} />);

    const after = Array.from(days()).filter(
      (day) => !day.hasAttribute("data-outside") && day.getAttribute("aria-label")?.includes("October"),
    );
    expect(after.some((day) => day.hasAttribute("disabled"))).toBe(true);
  });

  test("today is marked, so the user can find it in a month of numbers", () => {
    const today = new Date();
    render(() => <Calendar month={today} />);

    const marked = Array.from(days()).filter((day) => day.hasAttribute("data-today"));
    expect(marked).toHaveLength(1);
    expect(marked[0]!.getAttribute("aria-current")).toBe("date");
  });

  test("starts the week on Monday when asked", () => {
    const { container } = render(() => <Calendar month={october()} weekStartsOn={1} />);

    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers[0]!.textContent).toMatch(/Mon/i);
  });

  test("starts the week on Sunday by default", () => {
    const { container } = render(() => <Calendar month={october()} />);

    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers[0]!.textContent).toMatch(/Sun/i);
  });

  test("the grid is a grid, the header row is a row", () => {
    const { container } = render(() => <Calendar month={october()} />);

    expect(slot("calendar-grid")?.getAttribute("role")).toBe("grid");
    expect(container.querySelectorAll('[role="row"]').length).toBe(7);
    expect(container.querySelectorAll('[role="gridcell"]').length).toBe(42);
  });

  test("a controlled month does not move on its own", async () => {
    const { container } = render(() => <Calendar month={october()} />);

    await fireEvent.click(slot("calendar-next")!);

    // The host still says October, so the calendar must stay in October.
    expect(container.querySelector('[data-slot="calendar-caption"]')?.textContent).toMatch(/October/);
  });

  test("an uncontrolled calendar pages by itself", async () => {
    render(() => <Calendar defaultMonth={october()} />);

    await fireEvent.click(slot("calendar-next")!);
    expect(slot("calendar-caption")?.textContent).toMatch(/November/);
  });

  test("a day button works outside the grid too", async () => {
    let picked: Date | Date[] | undefined;
    render(() => (
      <Calendar month={october()} onSelect={(v) => (picked = v)}>
        <CalendarDayButton day={october(20)} />
      </Calendar>
    ));

    await fireEvent.click(slot("calendar-day-button")!);
    expect((picked as Date).getDate()).toBe(20);
  });

  test("a trigger shows the month it opens at", () => {
    render(() => <CalendarTrigger month={october()} />);
    expect(slot("calendar-trigger")?.textContent).toMatch(/October\s+2026/);
  });

  test("formats a date without a UTC shift", () => {
    // Parsing "2026-10-08" would give midnight UTC, which is the 7th for
    // anyone west of Greenwich.
    const text = formatDate(new Date(2026, 9, 8));
    expect(text).toMatch(/October 8, 2026/);
  });
});