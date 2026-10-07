import { describe, expect, test } from "bun:test";
import { variants } from "./variants";

const button = variants("inline-flex items-center", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border border-border",
      ghost: "hover:bg-hover",
    },
    size: {
      sm: "h-8 px-3",
      default: "h-9 px-4",
      icon: "size-9",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

describe("variants", () => {
  test("applies base and defaults with no props", () => {
    expect(button()).toBe(
      "inline-flex items-center bg-primary text-primary-foreground h-9 px-4",
    );
  });

  test("applies the requested variants", () => {
    expect(button({ variant: "outline", size: "sm" })).toBe(
      "inline-flex items-center border border-border h-8 px-3",
    );
  });

  test("fills only the groups that were not given", () => {
    expect(button({ size: "icon" })).toBe(
      "inline-flex items-center bg-primary text-primary-foreground size-9",
    );
  });

  test("lets the caller's class win over a variant class", () => {
    expect(button({ variant: "outline", class: "px-6" })).toContain("px-6");
    expect(button({ variant: "outline", class: "px-6" })).not.toContain("px-4");
  });

  test("accepts className as an alias of class", () => {
    expect(button({ className: "w-full" })).toContain("w-full");
  });

  test("treats null and undefined variant values as absent", () => {
    expect(button({ variant: null, size: undefined })).toBe(button());
  });

  test("works without a config", () => {
    const plain = variants("block");
    expect(plain()).toBe("block");
    expect(plain({ class: "flex" })).toBe("flex");
  });

  test("works with a config but no base", () => {
    const bare = variants(undefined, {
      variants: { tone: { quiet: "text-ink-3" } },
      defaultVariants: { tone: "quiet" },
    });
    expect(bare()).toBe("text-ink-3");
    expect(bare({ tone: "quiet", class: "truncate" })).toBe("text-ink-3 truncate");
  });

  test("applies a compound variant when every condition matches", () => {
    const compound = variants("base", {
      variants: {
        variant: { default: "a", outline: "b" },
        size: { sm: "1", default: "2" },
      },
      defaultVariants: { variant: "default", size: "default" },
      compoundVariants: [
        { variant: "outline", size: "sm", class: "combined" },
        { variant: "outline", size: "default", class: "outline-default" },
      ],
    });

    expect(compound({ variant: "outline", size: "sm" })).toContain("combined");
    expect(compound({ variant: "outline", size: "sm" })).not.toContain("outline-default");
    expect(compound({ variant: "outline", size: "default" })).toContain("outline-default");
    expect(compound({ variant: "outline", size: "default" })).not.toContain("combined");
    expect(compound({ variant: "default", size: "sm" })).not.toContain("combined");
  });

  test("matches a compound variant against resolved defaults", () => {
    const compound = variants("base", {
      variants: { variant: { default: "a", link: "b" } },
      defaultVariants: { variant: "default" },
      compoundVariants: [{ variant: "default", class: "uses-default" }],
    });

    // Nothing was passed, so the default is what the element renders with.
    expect(compound()).toContain("uses-default");
    expect(compound({ variant: "link" })).not.toContain("uses-default");
  });
});