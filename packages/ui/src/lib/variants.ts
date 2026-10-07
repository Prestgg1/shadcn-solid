import { cn, type ClassValue } from "./cn";

/**
 * A variant map: `group → value → classes`.
 *
 * ```ts
 * const variants = { variant: { default: "…", ghost: "…" } } as const
 * ```
 */
type VariantShape = Record<string, Record<string, string>>;

/** Props accepted by a variants function: one optional value per group, plus `class`. */
export type VariantSelection<T extends VariantShape> = {
  [K in keyof T]?: keyof T[K] | null | undefined;
} & { class?: ClassValue; className?: ClassValue };

export interface VariantsConfig<T extends VariantShape> {
  variants: T;
  /** Value used when the caller passes nothing for that group. */
  defaultVariants?: { [K in keyof T]?: keyof T[K] };
  /** Extra classes applied only when *every* listed variant matches. */
  compoundVariants?: readonly ({ [K in keyof T]?: keyof T[K] } & {
    class: ClassValue;
    className?: ClassValue;
  })[];
}

/** The function returned by {@link variants}. */
export type VariantsFn<T extends VariantShape> = (
  props?: VariantSelection<T> | null,
) => string;

/** Groups of a config, typed as plain string keys. */
type GroupKeys<T extends VariantShape> = (keyof T & string)[];

/** Resolve `{ variant: "ghost" }` against `defaultVariants` into a full value map. */
function resolve<T extends VariantShape>(
  selection: Record<string, unknown>,
  config: VariantsConfig<T>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const key of Object.keys(config.variants) as GroupKeys<T>) {
    const requested = selection[key];
    const value =
      requested === undefined || requested === null
        ? config.defaultVariants?.[key]
        : requested;
    if (value !== undefined) resolved[key] = value;
  }

  return resolved;
}

/**
 * Build a variant function — the same shape as `class-variance-authority`'s
 * `cva`, without the dependency.
 *
 * ```ts
 * const button = variants("inline-flex", {
 *   variants: {
 *     variant: { default: "bg-primary text-primary-foreground", ghost: "hover:bg-hover" },
 *     size: { sm: "h-8 px-3", default: "h-9 px-4" },
 *   },
 *   defaultVariants: { variant: "default", size: "default" },
 * });
 *
 * button();                                  // base + default/default
 * button({ variant: "ghost", size: "sm" });  // base + ghost + sm
 * button({ class: "w-full" });               // base + defaults + w-full
 * ```
 *
 * `class` is merged last, so a caller's class always beats a variant class.
 * That is the rule that lets components be restyled without `!important`.
 */
export function variants<T extends VariantShape>(
  base?: ClassValue,
  config?: VariantsConfig<T>,
): VariantsFn<T> {
  return (props) => {
    const selection = (props ?? {}) as Record<string, unknown>;
    const parts: ClassValue[] = [base];

    if (config) {
      // Defaults are resolved before anything is read, so compound variants
      // match the value the element will actually render with.
      const resolved = resolve<T>(selection, config);
      const groups = Object.keys(config.variants) as GroupKeys<T>;

      for (const key of groups) {
        const value = resolved[key];
        if (value === undefined) continue;
        const values = config.variants[key] as Record<string, string | undefined> | undefined;
        if (!values) continue;
        const classes = values[String(value)];
        if (classes) parts.push(classes);
      }

      for (const compound of config.compoundVariants ?? []) {
        const { class: compoundClass, className: compoundClassName, ...conditions } = compound;
        const matched = Object.entries(conditions).every(
          ([key, value]) => value === undefined || resolved[key] === value,
        );
        if (matched) parts.push(compoundClass, compoundClassName);
      }
    }

    parts.push(selection.class as ClassValue, selection.className as ClassValue);
    return cn(parts);
  };
}