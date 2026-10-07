import { describe, expect, test } from "bun:test";
import { fireEvent, render } from "@solidjs/testing-library";

import { Carousel, CarouselContent, CarouselDots, CarouselItem, CarouselNext, CarouselPrevious } from "./carousel";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSlots } from "./input-otp";
import {
  ChartArea,
  ChartContainer,
  ChartLegend,
  ChartLine,
  ChartReferenceLine,
  ChartStyle,
  ChartSvg,
  ChartTooltipContent,
  type ChartConfig,
} from "./chart";

const slot = (name: string) =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`);

const Slides = (props: { loop?: boolean; count?: number; controlled?: (i: number) => void }) => (
  <Carousel opts={{ loop: props.loop ?? false }} onIndexChange={props.controlled}>
    <CarouselContent>
      {Array.from({ length: props.count ?? 3 }, (_, index) => (
        <CarouselItem>
          <div>Slide {index}</div>
        </CarouselItem>
      ))}
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
    <CarouselDots />
  </Carousel>
);

const dot = (index: number) => document.querySelectorAll('[data-slot="carousel-dot"]')[index]!;

describe("Carousel", () => {
  test("announces itself as a carousel", () => {
    const { container } = render(() => <Slides />);

    const root = container.querySelector('[data-slot="carousel"]')!;
    expect(root.getAttribute("role")).toBe("region");
    expect(root.getAttribute("aria-roledescription")).toBe("carousel");
  });

  test("counts its slides from the children", () => {
    render(() => <Slides count={4} />);
    expect(document.querySelectorAll('[data-slot="carousel-dot"]').length).toBe(4);
  });

  test("Previous is disabled on the first slide", () => {
    render(() => <Slides />);
    expect(slot("carousel-previous")?.hasAttribute("disabled")).toBe(true);
  });

  test("Next is disabled on the last slide", async () => {
    render(() => <Slides count={2} />);

    await fireEvent.click(slot("carousel-next")!);
    expect(slot("carousel-next")?.hasAttribute("disabled")).toBe(true);
    expect(slot("carousel-previous")?.hasAttribute("disabled")).toBe(false);
  });

  test("Next and Previous move between slides", async () => {
    render(() => <Slides count={3} />);

    await fireEvent.click(slot("carousel-next")!);
    expect(dot(1).getAttribute("aria-current")).toBe("true");

    await fireEvent.click(slot("carousel-previous")!);
    expect(dot(0).getAttribute("aria-current")).toBe("true");
  });

  test("a dot jumps straight to its slide", async () => {
    render(() => <Slides count={3} />);

    await fireEvent.click(dot(2));

    expect(dot(2).getAttribute("aria-current")).toBe("true");
    // And stops there rather than sailing past the end.
    expect(slot("carousel-next")?.hasAttribute("disabled")).toBe(true);
  });

  test("stops at the ends without loop", async () => {
    render(() => <Slides count={2} />);

    await fireEvent.click(slot("carousel-next")!);
    await fireEvent.click(slot("carousel-next")!);

    expect(dot(1).getAttribute("aria-current")).toBe("true");
  });

  test("loop wraps in both directions", async () => {
    render(() => <Slides loop count={3} />);

    // Neither button is ever disabled when the ends are joined up.
    expect(slot("carousel-previous")?.hasAttribute("disabled")).toBe(false);
    expect(slot("carousel-next")?.hasAttribute("disabled")).toBe(false);

    await fireEvent.click(slot("carousel-previous")!);
    expect(dot(2).getAttribute("aria-current")).toBe("true");

    await fireEvent.click(slot("carousel-next")!);
    expect(dot(0).getAttribute("aria-current")).toBe("true");
  });

  test("arrow keys move, on the axis the carousel runs", async () => {
    const { container } = render(() => <Slides count={3} />);
    const content = slot("carousel-content")!;
    void container;

    await fireEvent.keyDown(content, { key: "ArrowRight" });
    expect(dot(1).getAttribute("aria-current")).toBe("true");

    await fireEvent.keyDown(content, { key: "ArrowLeft" });
    expect(dot(0).getAttribute("aria-current")).toBe("true");
  });

  test("a vertical carousel uses the vertical arrows", async () => {
    const { container } = render(() => (
      <Carousel orientation="vertical">
        <CarouselContent>
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
        </CarouselContent>
      </Carousel>
    ));

    await fireEvent.keyDown(slot("carousel-content")!, { key: "ArrowDown" });
    expect(container.querySelectorAll('[data-slot="carousel-dot"]').length).toBe(0);
    expect(container.querySelector('[data-slot="carousel-track"]')?.getAttribute("data-orientation")).toBe(
      "vertical",
    );
  });

  test("reports the slide it moved to", async () => {
    let at = -1;
    render(() => <Slides count={3} controlled={(index) => (at = index)} />);

    await fireEvent.click(slot("carousel-next")!);
    expect(at).toBe(1);
  });
});

const otpField = () => document.querySelector<HTMLInputElement>('[data-slot="input-otp-field"]')!;
const otpSlots = () => document.querySelectorAll<HTMLElement>('[data-slot="input-otp-slot"]');

const Otp = (props: { onComplete?: (value: string) => void; numeric?: boolean; maxLength?: number }) => (
  <InputOTP
    maxLength={props.maxLength ?? 6}
    onComplete={props.onComplete}
    numeric={props.numeric ?? true}
  >
    <InputOTPSlots count={props.maxLength ?? 6} />
  </InputOTP>
);

describe("InputOTP", () => {
  test("the real field is a single input, not one per box", () => {
    render(() => <Otp />);

    // Six inputs would break on paste and lose the browser's SMS autofill.
    expect(document.querySelectorAll("input").length).toBe(1);
    expect(otpField().getAttribute("inputmode")).toBe("numeric");
    expect(otpField().getAttribute("autocomplete")).toBe("one-time-code");
  });

  test("the boxes are hidden from assistive tech", () => {
    render(() => <Otp />);

    // The real input carries the semantics; announcing six empty boxes on top
    // of it would describe the same thing twice.
    expect(otpSlots()[0]!.getAttribute("aria-hidden")).toBe("true");
  });

  test("typing fills the boxes", async () => {
    render(() => <Otp />);

    await fireEvent.input(otpField(), { target: { value: "12" } });

    expect(otpSlots()[0]!.textContent).toBe("1");
    expect(otpSlots()[1]!.textContent).toBe("2");
    expect(otpSlots()[2]!.textContent).toBe("");
  });

  test("marks filled boxes", async () => {
    render(() => <Otp />);

    await fireEvent.input(otpField(), { target: { value: "1" } });
    expect(otpSlots()[0]!.hasAttribute("data-filled")).toBe(true);
    expect(otpSlots()[1]!.hasAttribute("data-filled")).toBe(false);
  });

  test("strips the spaces and dashes a pasted code arrives with", async () => {
    render(() => <Otp />);

    await fireEvent.input(otpField(), { target: { value: "123-456 789" } });

    expect(otpField().value).toBe("123456");
  });

  test("reports completion once every slot is filled", async () => {
    let done: string | undefined;
    render(() => <Otp onComplete={(value) => (done = value)} />);

    await fireEvent.input(otpField(), { target: { value: "123456" } });

    expect(done).toBe("123456");
  });

  test("does not report completion on a partial code", async () => {
    let done: string | undefined;
    render(() => <Otp onComplete={(value) => (done = value)} />);

    await fireEvent.input(otpField(), { target: { value: "12345" } });
    expect(done).toBeUndefined();
  });

  test("cannot be filled past its length", async () => {
    render(() => <Otp maxLength={4} />);

    await fireEvent.input(otpField(), { target: { value: "12345678" } });
    expect(otpField().value).toBe("1234");
  });

  test("keeps letters when numeric is off", async () => {
    render(() => <Otp numeric={false} />);

    await fireEvent.input(otpField(), { target: { value: "a1b2" } });
    expect(otpField().value).toBe("a1b2");
  });

  test("Backspace removes a digit", async () => {
    render(() => <Otp />);

    await fireEvent.input(otpField(), { target: { value: "12" } });
    await fireEvent.keyDown(otpField(), { key: "Backspace" });

    expect(otpField().value).toBe("1");
  });

  test("two fields on a page keep their own values", async () => {
    render(() => (
      <>
        <InputOTP defaultValue="11">
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
          </InputOTPGroup>
        </InputOTP>
        <InputOTP>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
          </InputOTPGroup>
        </InputOTP>
      </>
    ));

    const fields = document.querySelectorAll<HTMLInputElement>('[data-slot="input-otp-field"]');
    expect(fields[0]!.value).toBe("11");
    expect(fields[1]!.value).toBe("");
  });
});

const config: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--color-chart-1)" },
  costs: { label: "Costs", color: "var(--color-chart-2)" },
};

const data = [
  { label: "Jan", value: 40 },
  { label: "Feb", value: 70 },
  { label: "Mar", value: 55 },
];

describe("Chart", () => {
  test("injects the series colours as custom properties", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg />
      </ChartContainer>
    ));

    const style = slot("chart-style")!;
    // Colours resolve through a variable, so they follow the theme instead of
    // being baked into the markup.
    expect(style.innerHTML).toContain("--color-revenue: var(--color-chart-1)");
    expect(style.innerHTML).toContain("--color-costs: var(--color-chart-2)");
  });

  test("scopes the variables to this chart, so two cannot collide", () => {
    const { container } = render(() => (
      <>
        <ChartContainer config={config}>
          <ChartSvg />
        </ChartContainer>
        <ChartContainer config={config}>
          <ChartSvg />
        </ChartContainer>
      </>
    ));

    const ids = Array.from(container.querySelectorAll('[data-slot="chart"]')).map((node) =>
      node.getAttribute("data-chart"),
    );
    const styles = Array.from(container.querySelectorAll('[data-slot="chart-style"]')).map(
      (node) => node.innerHTML,
    );

    expect(ids[0]).not.toBe(ids[1]);
    expect(styles).toHaveLength(2);
    // A global <style> would let the second chart redefine the first one's
    // colours, which is the failure this scoping exists to prevent.
    expect(styles[0]).toContain(`[data-chart="${ids[0]}"]`);
    expect(styles[1]).toContain(`[data-chart="${ids[1]}"]`);
  });

  test("draws a line through every point", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg>
          <ChartLine data={data} series="revenue" />
        </ChartSvg>
      </ChartContainer>
    ));

    const line = slot("chart-line")!;
    // Three points: x at 0, 50, 100; y scaled against the largest value.
    expect(line.getAttribute("points")?.split(" ")).toHaveLength(3);
    expect(line.getAttribute("stroke")).toBe("var(--color-chart-1)");
    expect(line.getAttribute("fill")).toBe("none");
  });

  test("strokes do not scale with the viewBox", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg>
          <ChartLine data={data} series="revenue" />
        </ChartSvg>
      </ChartContainer>
    ));

    // The chart scales; a 2px line must not become a 4px one on a wide screen.
    expect(slot("chart-line")?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });

  test("fills an area down to the baseline", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg>
          <ChartArea data={data} series="costs" />
        </ChartSvg>
      </ChartContainer>
    ));

    const area = slot("chart-area")!;
    expect(area.tagName).toBe("polygon");
    expect(area.getAttribute("points")?.startsWith("0,100")).toBe(true);
  });

  test("an empty series draws nothing rather than throwing", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg>
          <ChartLine data={[]} series="revenue" />
        </ChartSvg>
      </ChartContainer>
    ));

    expect(slot("chart-line")?.getAttribute("points")).toBe("");
  });

  test("a legend names every series", () => {
    const { container } = render(() => (
      <ChartContainer config={config}>
        <ChartLegend />
      </ChartContainer>
    ));

    const legend = container.querySelector('[data-slot="chart-legend"]')!;
    expect(legend.textContent).toContain("Revenue");
    expect(legend.textContent).toContain("Costs");
  });

  test("a tooltip names the series and its value", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg />
        <ChartTooltipContent point={data[0]!} series="revenue" />
      </ChartContainer>
    ));

    const tooltip = slot("chart-tooltip")!;
    expect(tooltip.getAttribute("role")).toBe("tooltip");
    expect(tooltip.textContent).toContain("Jan");
    expect(tooltip.textContent).toContain("Revenue");
    expect(tooltip.textContent).toContain("40");
  });

  test("a reference line is drawn at its value", () => {
    render(() => (
      <ChartContainer config={config}>
        <ChartSvg>
          <ChartReferenceLine y={80} />
        </ChartSvg>
      </ChartContainer>
    ));

    const line = slot("chart-reference-line")!;
    expect(line.getAttribute("y1")).toBe("80");
    expect(line.getAttribute("x2")).toBe("100");
  });

  test("ChartStyle works standalone", () => {
    render(() => <ChartStyle config={config} id="custom" />);
    expect(slot("chart-style")?.innerHTML).toContain('[data-chart="custom"]');
  });
});
