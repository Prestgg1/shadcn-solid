import type { JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

/**
 * Render `as` (default `"div"`), forwarding everything else.
 *
 * This is Solid's answer to Kobalte's `Polymorphic`, kept here so no
 * headless primitive has to be installed for it. Reach for `asChild` first —
 * this component is for cases where the caller wants the component to choose
 * the element itself.
 */
export function Polymorphic(props: {
  as?: ValidComponent;
  [key: string]: unknown;
}): JSX.Element {
  const [local, rest] = splitProps(props, ["as"]);
  return <Dynamic component={local.as ?? "div"} {...rest} />;
}