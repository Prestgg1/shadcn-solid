import { describe, expect, test } from "bun:test";
import { render } from "@solidjs/testing-library";

import { Button, buttonVariants } from "./button";

describe("buttonVariants", () => {
  test("applies the default variant and size", () => {
    const classes = buttonVariants();
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("h-9");
  });

  test("switches variant", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-accent");
  });

  test("switches size", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-8");
    expect(buttonVariants({ size: "icon" })).toContain("size-9");
    expect(buttonVariants({ size: "icon-lg" })).toContain("size-10");
  });

  test("lets the caller's class win over the variant's", () => {
    expect(buttonVariants({ size: "sm", class: "h-14" })).toContain("h-14");
  });
});

describe("Button", () => {
  test("renders a button with slot and variant attributes", () => {
    const { getByRole } = render(() => <Button>Save</Button>);
    const button = getByRole("button");

    expect(button.getAttribute("data-slot")).toBe("button");
    expect(button.getAttribute("data-variant")).toBe("default");
    expect(button.getAttribute("data-size")).toBe("default");
    expect(button.textContent).toBe("Save");
  });

  test("reflects variant and size", () => {
    const { getByRole } = render(() => (
    <Button variant="outline" size="sm">
      Cancel
    </Button>
  ));
    const button = getByRole("button");

    expect(button.getAttribute("data-variant")).toBe("outline");
    expect(button.getAttribute("data-size")).toBe("sm");
    expect(button.className).toContain("h-8");
  });

  test("is disabled by the native attribute", () => {
    const { getByRole } = render(() => <Button disabled>Save</Button>);
    expect(getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  test("calls onClick", () => {
    let clicks = 0;
    const { getByRole } = render(() => <Button onClick={() => (clicks += 1)}>Save</Button>);
    getByRole("button").click();
    expect(clicks).toBe(1);
  });

  test("forwards arbitrary attributes", () => {
    const { getByRole } = render(() => <Button aria-label="Settings" />);
    expect(getByRole("button").getAttribute("aria-label")).toBe("Settings");
  });
});
