/**
 * The Babel packages are build-time only, and none of them ship usable types.
 * Declaring them here keeps `tsc` strict about the rest of the codebase
 * instead of widening to `any` at every call site.
 */
declare module "@babel/core" {
  export function transformAsync(
    code: string,
    options: Record<string, unknown>,
  ): Promise<{ code: string | null | undefined } | null>;
}

declare module "@babel/preset-typescript" {
  const preset: unknown;
  export default preset;
}

declare module "babel-preset-solid" {
  const preset: unknown;
  export default preset;
}
