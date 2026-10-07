# @prestgg/solid-ui

shadcn/ui for SolidJS. Components are copied into your project, not imported
from this package — you own the code, and an update to the library never
overwrites your changes.

Built on Solid 2, with no headless component library underneath: the runtime
primitives are ~1,100 lines of DOM code you can read, and the whole package
depends on three things — `clsx`, `tailwind-merge` and `@floating-ui/dom`.

```bash
bun add @prestgg/solid-ui solid-js @solidjs/web
bunx solid-ui init
bunx solid-ui add button dialog card
```

## Why Solid 2

`@solidjs/compiler` is Solid's native Oxc compiler — Rust, no Babel. Solid 1
had no native compiler, which is why every Bun user had to pull Babel in.

Bun's automatic JSX runtime looks for `jsx`, `jsxs` and `jsxDEV`. Neither
`solid-js/web` nor `@solidjs/web` exports them, so Solid's JSX has to be
compiled before Bun ever sees it. `@prestgg/solid-jsx` does that, with zero
build dependencies:

```bash
bun add -D @prestgg/solid-jsx @solidjs/compiler
bunx solid-jsx init
bunx solid-jsx check     # reports anything still missing
```

## What's here

| | |
|---|---|
| Components | 27 of shadcn's 61 — the markup, form and list layers |
| Primitives | `focusTrap` `presence` `rovingFocus` `scrollLock` `floatingPanel` `dismissable` `Portal` `asChild` `Polymorphic` |
| Runtime deps | `clsx` `tailwind-merge` `@floating-ui/dom` |
| Peers | `solid-js` `@solidjs/web` (≥ 2.0.0-rc.13) |

Each primitive exists because hand-rolling it is where accessibility and
correctness usually go wrong — `focusTrap` pulls focus back when it escapes,
`rovingFocus` keeps a menu a single tab stop, `scrollLock` is reference
counted so a sheet closing does not unlock the dialog behind it.

## Pinning

`@solidjs/web`'s `latest` tag currently points at an older RC than
`solid-js@next`. Pin the whole set to one version:

```jsonc
{
  "dependencies": {
    "solid-js": "2.0.0-rc.13",
    "@solidjs/web": "2.0.0-rc.13",
    "@prestgg/solid-ui": "^0.1.0"
  }
}
```

SolidStart is not yet compatible with Solid 2 — `@solidjs/start` depends on
`solid-js ^1.9`. On Vite, use `@solidjs/vite-plugin`.

## CLI

```
solid-ui init     components.json, the stylesheet, the cn helper
solid-ui add      copy components and their dependencies
solid-ui remove   delete files this tool created
solid-ui list     every registry item
solid-ui view     an item's source and documentation
solid-ui search   find items by name or description
```

`solid-ui add` resolves `registryDependencies`, so `add dialog` brings the
pieces dialog needs. Existing files are never overwritten without
`--overwrite`.

## For agents

`AGENTS.md` is the operational guide: the `data-slot` convention, the Solid 2
semantics that break tests, and the commands to run. `llms.txt` and
`llms-full.txt` are generated from the registry and are the cheapest way in.

## Status

Solid 2 is a release candidate and its APIs may still change. This library
targets `rc.13`; expect a version bump when Solid 2 goes stable.

## License

MIT