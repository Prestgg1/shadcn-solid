# For coding agents

`@prestgg/solid-ui` is shadcn/ui for SolidJS. Components are **copied into
your project**, not imported from this package — `npx solid-ui add button`
writes `src/components/ui/button.tsx` and you own it from then on.

## Setup

```bash
bun add @prestgg/solid-ui solid-js @solidjs/web
bunx solid-ui init
```

This library targets **Solid 2.0-rc**. `@solidjs/web`'s `latest` tag lags
behind `solid-js@next`, so pin explicitly:

```jsonc
// package.json
{
  "dependencies": {
    "solid-js": "2.0.0-rc.13",
    "@solidjs/web": "2.0.0-rc.13",
    "@prestgg/solid-ui": "^0.1.0"
  }
}
```

## Reading the anatomy

Every element carries `data-slot`. This is the supported way to find a piece
of a component — `grep 'data-slot="dialog-overlay"'` is faster and more
reliable than reading the file.

| Component | Slots |
|---|---|
| `button` | `button` |
| `card` | `card`, `card-header`, `card-title`, `card-description`, `card-action`, `card-content`, `card-footer` |
| `item` | `item`, `item-group`, `item-media`, `item-content`, `item-header`, `item-title`, `item-description`, `item-actions`, `item-footer`, `item-separator` |
| `table` | `table-container`, `table`, `table-header`, `table-body`, `table-footer`, `table-row`, `table-head`, `table-cell`, `table-caption` |
| `dialog` | `dialog-trigger`, `dialog-overlay`, `dialog-content`, `dialog-header`, `dialog-footer`, `dialog-title`, `dialog-description` |
| `alert-dialog` | `alert-dialog-trigger`, `alert-dialog-overlay`, `alert-dialog-content`, `alert-dialog-header`, `alert-dialog-footer`, `alert-dialog-title`, `alert-dialog-description`, `alert-dialog-cancel`, `alert-dialog-action` |
| `sheet` | `sheet-trigger`, `sheet-overlay`, `sheet-content`, `sheet-header`, `sheet-footer`, `sheet-title`, `sheet-description` |
| `drawer` | `drawer-trigger`, `drawer-overlay`, `drawer-content`, `drawer-handle`, `drawer-header`, `drawer-footer`, `drawer-title`, `drawer-description` |
| `popover` | `popover-trigger`, `popover-content`, `popover-arrow`, `popover-group`, `popover-separator` |
| `hover-card` | `hover-card-trigger`, `hover-card-content`, `hover-card-title`, `hover-card-description` |
| `tooltip` | `tooltip-trigger`, `tooltip-content` |
| `accordion` | `accordion`, `accordion-group`, `accordion-item`, `accordion-heading`, `accordion-trigger`, `accordion-content` |
| `tabs` | `tabs`, `tabs-list`, `tabs-trigger`, `tabs-content` |
| `collapsible` | `collapsible`, `collapsible-trigger`, `collapsible-content` |
| `scroll-area` | `scroll-area`, `scroll-area-viewport`, `scroll-area-scrollbar`, `scroll-area-thumb`, `scroll-area-corner` |
| `resizable` | `resizable-group`, `resizable-panel`, `resizable-handle`, `resizable-grip` |

Run `solid-ui view <name>` for the full slot list and the source.

## Conventions

- **Variants come from `variants()`**, not `cva`. Same API shape, no
  dependency. `buttonVariants()` is exported so you can reuse the classes on
  something that is not a `Button`.
- **Class composition goes through `cn()`.** Never `!important` to beat a
  component default — pass `class` and let `cn` decide.
- **Props are values, not accessors.** Solid 2: read `props.variant`, do not
  destructure the props object, and pass `<X value={count()} />`.
- **`split(props, keys)` replaces Solid 1's `splitProps`.** It returns
  `[local, rest]`; both halves are proxies, never copies. Reading
  `props.children` during the split would evaluate the subtree before the
  component body runs and break every provider above it, so it must stay lazy.
- **An element a component's own JSX creates needs a signal, not a
  variable.** `<Show>` mounts its content after the body has run, so
  `let panel!: HTMLElement; focusTrap(panel, …)` hands the primitive
  `undefined` forever. Use `const [panel, setPanel] = createSignal<HTMLElement>()`.
- **`asChild` has one limitation.** Solid has no `cloneElement`, so the
  component's attributes are written onto the already-created element once, at
  mount. If the class must change later, use `Polymorphic` / `as` instead.

## Solid 2 semantics that bite

These are the ones that produce confusing test failures:

1. **Setters are microtask-batched.** `setX(1); x()` still reads the old
   value until the next flush. Tests need `flush()` from `solid-js` after an
   event.
2. **`createEffect` takes two arguments.** `createEffect(compute, apply)`.
   The apply phase runs on **every** pass including the first, so a guard
   belongs inside it, not in the compute.
3. **`onCleanup` inside an effect's apply phase does not run on dispose.**
   Return the teardown from the apply phase instead — that is what Solid
   calls.
5. **Props are not accessors.** `<Dialog open={open()} …>`, and a signal
   setter from `createSignal` can be passed straight to `onOpenChange`.
4. **`Context.Provider` is gone.** The context object is the provider
   component: `<MyContext value={x}>`.

## Tests

```bash
bun test --conditions=browser
```

`--conditions=browser` is required: without it `@solidjs/web` resolves to its
server build and every render throws "client-only API called on the server
side".

For `bun test` to compile JSX, `bunfig.toml` needs the preload under `[test]`,
not at the top level:

```toml
preload = ["./solid-preload.ts"]

[test]
preload = ["./dom-setup.ts", "./solid-preload.ts"]
```

`@prestgg/solid-jsx` provides `solidBunPlugin()`. Run `solid-jsx check` to
verify a project is wired correctly.

## Discovery

- `solid-ui list --plain` — every item, one name per line
- `solid-ui search <query> --plain` — same, filtered
- `solid-ui view <name>` — source plus documentation
- `llms.txt` — this file's subject, as a short index
- `llms-full.txt` — every component's reference in one document

## Layout

```
packages/ui/       the components and the primitives they are built on
packages/cli/      solid-ui — the installer
packages/solid-jsx Solid JSX for Bun, on the native compiler
apps/docs/         the documentation site
```