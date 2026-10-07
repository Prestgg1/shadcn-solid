import { type JSX, type ValidComponent, children, createMemo, mergeProps } from "solid-js";
import { Dynamic } from "solid-js/web";

/** A child that can carry props, as opposed to a string or a fragment. */
function propsOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Radix's `Slot`, for Solid.
 *
 * `asChild` lets a caller pass an element instead of the component's own, so
 * the component supplies behaviour and styling while the caller keeps control
 * of the element — `<Button asChild><a href="/x">Go</a></Button>` renders an
 * `<a>` that is still a button.
 *
 * The child's own props win over the injected ones, except for `class`, which
 * is concatenated so the component's styling always comes first and the
 * caller can always add to it.
 *
 * ```tsx
 * const attributes = () => ({ "data-slot": "button", class: "…" });
 * return props.asChild
 *   ? asChild(() => props.children, attributes)
 *   : <button {...attributes()} {...rest}>{props.children}</button>;
 * ```
 */
export function asChild(
  component: () => JSX.Element,
  inject: (childProps: Record<string, unknown>) => Record<string, unknown>,
): JSX.Element {
  const resolved = children(component);

  const merged = createMemo(() => {
    const own = propsOf(resolved());
    const injected = inject(own);

    return mergeProps(injected, own, {
      class: [injected.class as JSX.Element, own.class as JSX.Element] as JSX.Element,
    }) as Record<string, unknown>;
  });

  return <Dynamic component={merged() as unknown as ValidComponent} {...merged()} />;
}