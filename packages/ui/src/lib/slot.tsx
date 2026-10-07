import { type Element, children, createEffect } from "solid-js";

/**
 * Read an element's current attributes as a props object.
 *
 * `class` and `style` are read as strings because that is how they come back
 * from the DOM, and callers merge them with `cn`.
 */
function propsOf(node: Element): Record<string, unknown> {
  const element = node as unknown as globalThis.Element;
  const props: Record<string, unknown> = {};

  for (const attribute of Array.from(element.attributes)) {
    props[attribute.name] = attribute.value;
  }

  return props;
}

/** Keys an element must never have overwritten on it. */
const RESERVED = new Set(["children"]);

/**
 * Radix's `Slot`, for Solid.
 *
 * `asChild` lets a caller pass an element instead of the component's own, so
 * the component supplies behaviour and styling while the caller keeps control
 * of the element — `<Button asChild><a href="/x">Go</a></Button>` renders an
 * `<a>` that is still a button.
 *
 * **How it differs from Radix's Slot, and why.** Solid has no
 * `cloneElement`: by the time `asChild` runs, the child has already been
 * compiled into a real DOM element. So instead of cloning, this applies the
 * component's attributes to that element.
 *
 * The consequence is one honest limitation: the attributes are written once,
 * when the slot mounts. If the component's `class` or `data-state` later
 * changes, the caller's element does not follow — `class` was already
 * consumed by the browser. For everything else (event handlers, `aria-*`,
 * `disabled`) the element keeps working normally.
 *
 * When a class has to change after mount, use the `as` prop instead:
 *
 * ```tsx
 * <Button as="a" href="/docs">Docs</Button>
 * ```
 *
 * ```tsx
 * const attributes = () => ({ "data-slot": "button", class: "…" });
 * return props.asChild
 *   ? asChild(() => props.children, attributes)
 *   : <button {...attributes()} {...rest}>{props.children}</button>;
 * ```
 */
export function asChild(
  component: () => Element,
  inject: (childProps: Record<string, unknown>) => Record<string, unknown>,
): Element {
  const resolved = children(component);
  const node = resolved();

  if (!(node instanceof Element)) {
    throw new Error(
      "asChild expects a single DOM element as its child — a fragment or a text node cannot receive component attributes.",
    );
  }

  createEffect(
    () => node,
    () => {
      /** Listeners added this pass, so the next pass can remove them. */
      const listeners: [string, EventListener][] = [];

      for (const [key, value] of Object.entries(inject(propsOf(node)))) {
        if (RESERVED.has(key)) continue;

        // A function is behaviour, not markup. `ref` is called; `onX`
        // becomes a real listener. Writing these as attributes would produce
        // `onclick="() => …"` on the element and nothing would ever fire —
        // which is exactly the behaviour a slot is being used to get.
        if (typeof value === "function") {
          if (key === "ref") {
            (value as (element: Element) => void)(node);
            continue;
          }

          const type = key.startsWith("on") ? key.slice(2).toLowerCase() : key;
          const listener = value as EventListener;
          node.addEventListener(type, listener);
          listeners.push([type, listener]);
          continue;
        }

        if (key === "class") {
          const existing = node.getAttribute("class");
          const next = [value, existing].filter(Boolean).join(" ");
          if (next) node.setAttribute("class", next);
          continue;
        }

        if (value === undefined || value === null || value === false) {
          node.removeAttribute(key);
        } else {
          node.setAttribute(key, value === true ? "" : String(value));
        }
      }

      // Returned, not `onCleanup`: in Solid 2 a cleanup registered inside an
      // effect's apply phase does not run on dispose.
      return () => {
        for (const [type, listener] of listeners) {
          node.removeEventListener(type, listener);
        }
      };
    },
  );

  return node;
}