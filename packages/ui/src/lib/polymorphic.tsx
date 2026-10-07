import { type Element, type ValidComponent } from "solid-js";
import { dynamic } from "@solidjs/web";

/**
 * Render `as`, forwarding everything else.
 *
 * Solid's answer to Kobalte's `Polymorphic`, kept here so no headless
 * primitive has to be installed for it.
 *
 * Prefer `asChild` when the caller supplies the element. Use this when the
 * *component* should choose the tag — which is also the only form whose
 * attributes stay reactive, since it goes through the JSX compiler rather
 * than through a DOM mutation.
 *
 * ```tsx
 * <Polymorphic as="a" href="/docs">Docs</Polymorphic>
 * ```
 */
export function Polymorphic(props: {
  as?: ValidComponent;
  [key: string]: unknown;
}): Element {
  const Element_ = dynamic(() => props.as ?? "div");
  return (
    <Element_
      {...(Object.fromEntries(
        Object.entries(props).filter(([key]) => key !== "as"),
      ) as Record<string, unknown>)}
    />
  );
}