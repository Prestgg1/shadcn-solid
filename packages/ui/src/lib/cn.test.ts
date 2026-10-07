import { describe, expect, test } from "bun:test";
import { cn } from "./cn";

describe("cn", () => {
  test("joins plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  test("drops falsy values", () => {
    const disabled = false as boolean;
    expect(cn("a", disabled && "b", undefined, null, "")).toBe("a");
  });

  test("later classes win over earlier ones from the same group", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  test("keeps unrelated groups", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  test("resolves the extended font-size scale", () => {
    // `text-md` is this library's 15px step; tailwind-merge does not know
    // it by default, so the extension is what makes it conflict with
    // `text-sm` instead of stacking.
    expect(cn("text-sm", "text-md")).toBe("text-md");
    expect(cn("text-md", "text-sm")).toBe("text-sm");
    expect(cn("text-sm", "text-md", "text-lg")).toBe("text-lg");
  });

  test("does not confuse colour with font-size", () => {
    expect(cn("text-ink-3", "text-sm")).toBe("text-ink-3 text-sm");
  });

  test("accepts arrays and records, like clsx", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });
});