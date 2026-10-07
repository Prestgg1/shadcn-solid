import { omit } from "solid-js";

/**
 * Split a props object into the keys a component handles and the rest it
 * forwards.
 *
 * Solid 1 had `splitProps`, returning `[local, rest]`. Solid 2 replaced it
 * with `omit`, which returns **only** the rest — there is no tuple. This
 * restores the shape every component here was written against, and it has to
 * stay precise: `local` carries the keys that were split out, `rest` does
 * not. Widening either to `T` makes `{...rest}` look like it is re-applying
 * `onChange` and friends to the element, which is both a type error and a
 * real bug waiting to happen.
 *
 * ```ts
 * const [local, rest] = split(props, ["class", "variant"]);
 * ```
 *
 * `omit` is used rather than a loop because it returns a proxy that keeps
 * reading `rest.x` reactive; a plain object copy would freeze every
 * forwarded prop at split time.
 */
export function split<T extends object, const K extends readonly (keyof T)[]>(
  props: T,
  keys: K,
): [Pick<T, K[number]>, Omit<T, K[number]>] {
  const local = {} as Pick<T, K[number]>;
  for (const key of keys) {
    if (key in props) local[key] = props[key] as T[K[number]];
  }

  // `omit` is generic over a `readonly (keyof T)[]` tuple and returns
  // `Omit<T, K>`; spreading `K` through an array widens the tuple, so the
  // restated type is asserted here rather than at 27 call sites.
  const rest = omit(props, ...keys) as unknown as Omit<T, K[number]>;

  return [local, rest];
}

/**
 * `true` when the props object carries a value for a key.
 *
 * Distinguishes "not passed" from "passed as `undefined`", which matters for
 * defaults: `<Button size={undefined}>` should fall back to the default, and
 * `<Button asChild={undefined}>` must not take the slot path.
 */
export function has<T extends object>(props: T, key: keyof T): boolean {
  return key in props && props[key] !== undefined;
}