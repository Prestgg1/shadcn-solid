import { For, Show, createMemo, createSignal } from "solid-js";
import { render } from "@solidjs/web";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import { Separator } from "~/components/ui/separator";

import { counts, components, primitives, sourcesOf } from "./registry";

/**
 * The component reference.
 *
 * One page rather than a router: every component's source is already in the
 * bundle, and a reader arriving from `llms.txt` wants the whole thing in one
 * document they can search. A router would only add a load between the
 * reader and the code.
 */

function InstallCommand(props: { items: string[] }) {
  return (
    <pre class="overflow-x-auto rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs">
      <code>{`bunx solid-ui@latest add ${props.items.join(" ")}`}</code>
    </pre>
  );
}

function SourceBlock(props: { name: string; code: string }) {
  const [open, setOpen] = createSignal(false);
  const lines = createMemo(() => props.code.split("\n"));

  return (
    <div class="rounded-md border border-line bg-surface-2">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
        aria-expanded={open() ? "true" : "false"}
        onClick={() => setOpen(!open())}
      >
        <span class="font-mono text-ink-2">{props.name}</span>
        <span class="text-ink-4">{open() ? "hide" : `${lines().length} lines`}</span>
      </button>
      <Show when={open()}>
        <pre class="max-h-96 overflow-auto border-t border-line px-3 py-2 font-mono text-xs leading-relaxed text-ink-2">
          <code>{props.code}</code>
        </pre>
      </Show>
    </div>
  );
}

function ComponentEntry(props: { item: (typeof components)[number] }) {
  const sources = () => sourcesOf(props.item);

  return (
    <Card class="scroll-mt-8">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <span class="font-mono">{props.item.name}</span>
          <Badge variant="secondary">{props.item.title}</Badge>
        </CardTitle>
        <Show when={props.item.description}>
          {(description) => <p class="text-sm text-muted-foreground">{description()}</p>}
        </Show>
      </CardHeader>
      <CardContent class="grid gap-4">
        <InstallCommand items={[props.item.name, ...(props.item.registryDependencies ?? [])]} />

        <Show when={props.item.dependencies?.length}>
          <p class="text-xs text-ink-3">
            <span class="text-ink-4">dependencies:</span>{" "}
            <span class="font-mono">{props.item.dependencies?.join(", ")}</span>
          </p>
        </Show>

        <Show when={props.item.registryDependencies?.length}>
          <p class="text-xs text-ink-3">
            <span class="text-ink-4">registry dependencies:</span>{" "}
            <span class="font-mono">{props.item.registryDependencies?.join(", ")}</span>
          </p>
        </Show>

        <div class="grid gap-2">
          <For each={sources()}>
            {(source) => <SourceBlock name={source.name} code={source.code} />}
          </For>
        </div>
      </CardContent>
    </Card>
  );
}

function App() {
  const [query, setQuery] = createSignal("");

  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase();
    if (!needle) return components;
    return components.filter((item) =>
      `${item.name} ${item.description ?? ""}`.toLowerCase().includes(needle),
    );
  });

  return (
    <main class="mx-auto max-w-3xl px-6 py-16">
      <header class="grid gap-4">
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-semibold">@prestgg/solid-ui</h1>
          <Badge>v0.1</Badge>
        </div>
        <p class="text-muted-foreground">
          shadcn/ui for SolidJS. Components are copied into your project, not imported —
          you own the code.
        </p>

        <KbdGroup class="text-xs text-ink-4">
          <Kbd>bun</Kbd>
          <span>add solid-js @solidjs/web @prestgg/solid-ui</span>
          <Kbd>bunx</Kbd>
          <span>solid-ui init</span>
        </KbdGroup>

        <InstallCommand items={["button", "card", "dialog"]} />
      </header>

      <Separator class="my-8" />

      <section class="grid gap-4">
        <h2 class="text-lg font-medium">
          Components <span class="text-muted-foreground">({counts.components})</span>
        </h2>

        <input
          type="search"
          placeholder="Filter components"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          class="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <div class="grid gap-2">
          <For each={filtered()}>
            {(item) => (
              <a
                href={`#${item.name}`}
                class="flex items-center justify-between rounded-md px-3 py-1.5 font-mono text-sm text-ink-2 hover:bg-accent"
              >
                <span>{item.name}</span>
                <span class="truncate pl-4 text-xs text-ink-4">{item.description}</span>
              </a>
            )}
          </For>
        </div>
      </section>

      <div class="grid gap-6">
        <For each={filtered()}>{(item) => <ComponentEntry item={item} />}</For>
      </div>

      <Separator class="my-10" />

      <section class="grid gap-4">
        <h2 class="text-lg font-medium">
          Primitives <span class="text-muted-foreground">({counts.primitives})</span>
        </h2>
        <p class="text-sm text-muted-foreground">
          What the components above are built from. Copy-paste them when you need the
          behaviour without the styling.
        </p>
        <For each={primitives}>
          {(item) => (
            <div class="rounded-md border border-line px-3 py-2">
              <p class="font-mono text-sm text-ink-2">{item.name}</p>
              <p class="text-sm text-muted-foreground">{item.description}</p>
            </div>
          )}
        </For>
      </section>

      <footer class="mt-16 grid gap-2 text-sm text-muted-foreground">
        <p>
          <span class="font-mono text-ink-2">{counts.items}</span> registry items,{" "}
          <span class="font-mono text-ink-2">{counts.components}</span> of them components. The
          registry is read at build time, so a page cannot describe something the installer
          does not ship.
        </p>
        <p>
          Full machine-readable reference: <span class="font-mono">/llms.txt</span> and{" "}
          <span class="font-mono">/llms-full.txt</span>.
        </p>
      </footer>
    </main>
  );
}

const root = document.getElementById("app");
if (root) render(() => <App />, root);

