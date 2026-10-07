#!/usr/bin/env bun
/**
 * `@prestgg/solid-ui` CLI.
 *
 * Binary names: `solid-ui` and `shadcn-solid`.
 *
 * Commands mirror shadcn's, so muscle memory carries over:
 *
 *   solid-ui init            write components.json, styles, the cn helper
 *   solid-ui add <items>     copy components into your project
 *   solid-ui list            every item in the registry
 *   solid-ui view <item>     print an item's source and docs
 *   solid-ui search <query>  find items by name or description
 */

import { Command } from "commander";

import { add, init } from "./commands/add";
import { list, search, view } from "./commands/read";
import { error, log } from "./utils/log";

const VERSION = "0.1.0";

const program = new Command();

program
  .name("solid-ui")
  .description("Copy shadcn/ui components into a SolidJS project.")
  .version(VERSION, "-v, --version", "Print the version.");

program
  .command("init")
  .description("Set up components.json, the stylesheet and the cn helper.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .option("-y, --yes", "Answer every prompt with its default.", false)
  .action(async (options: { cwd: string; yes: boolean }) => {
    await init(options);
  });

program
  .command("add")
  .description("Add one or more registry items to your project.")
  .argument("[items...]", "Item names. Namespaced items like @acme/table work too.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .option("-y, --yes", "Skip prompts.", false)
  .option("-a, --all", "Add every item in the registry.", false)
  .option("-o, --overwrite", "Replace files that already exist.", false)
  .option("-r, --registry <url>", "Read items from this registry instead.")
  .option("--silent", "Do not install dependencies.", false)
  .action(async (items: string[], options: Record<string, unknown>) => {
    await add(items, {
      cwd: String(options.cwd),
      yes: Boolean(options.yes),
      all: Boolean(options.all),
      overwrite: Boolean(options.overwrite),
      registry: options.registry === undefined ? undefined : String(options.registry),
      silent: Boolean(options.silent),
    });
  });

program
  .command("list")
  .description("List every item in the registry.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .option("-r, --registry <url>", "Read from this registry instead.")
  .option("--plain", "Machine-readable output: one name per line.", false)
  .option("--type <type>", "Filter by registry type, e.g. registry:ui.")
  .action(async (options: Record<string, unknown>) => {
    await list({
      cwd: String(options.cwd),
      registry: options.registry === undefined ? undefined : String(options.registry),
      plain: Boolean(options.plain),
      type: options.type === undefined ? undefined : String(options.type),
    });
  });

program
  .command("view")
  .description("Print an item's source and documentation.")
  .argument("<item>", "Item name.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .option("-r, --registry <url>", "Read from this registry instead.")
  .option("--docs-only", "Print documentation only.", false)
  .option("--source-only", "Print source only.", false)
  .action(async (item: string, options: Record<string, unknown>) => {
    await view(item, {
      cwd: String(options.cwd),
      registry: options.registry === undefined ? undefined : String(options.registry),
      docsOnly: Boolean(options.docsOnly),
      sourceOnly: Boolean(options.sourceOnly),
    });
  });

program
  .command("search")
  .description("Find registry items by name or description.")
  .argument("<query>", "What to look for.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .option("-r, --registry <url>", "Read from this registry instead.")
  .option("--plain", "Machine-readable output: one name per line.", false)
  .action(async (query: string, options: Record<string, unknown>) => {
    await search(query, {
      cwd: String(options.cwd),
      registry: options.registry === undefined ? undefined : String(options.registry),
      plain: Boolean(options.plain),
    });
  });

program.parseAsync(process.argv).catch((cause: unknown) => {
  log();
  error(cause instanceof Error ? cause.message : String(cause));
  process.exitCode = 1;
});