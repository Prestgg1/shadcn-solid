#!/usr/bin/env bun
/**
 * `@prestgg/solid-jsx` CLI.
 *
 * One command, because there is one job: make Bun able to compile Solid.
 *
 *   solid-jsx init      write the preload and point tsconfig at the runtime
 *   solid-jsx check     report whether this project is set up, and what is missing
 */

import { Command } from "commander";

import { applyConfig, solidPreloadSource } from "../src/config";
import { detectSolidMajor } from "../src/transform";

const VERSION = "0.1.0";

function fail(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

const program = new Command();

program
  .name("solid-jsx")
  .description("Compile Solid JSX in Bun, with the native Oxc compiler and no Babel.")
  .version(VERSION, "-v, --version", "Print the version.");

program
  .command("init")
  .description("Add the Bun preload and set jsxImportSource in tsconfig.json.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .option("-f, --force", "Overwrite an existing preload file.", false)
  .action(async (options: { cwd: string; force: boolean }) => {
    const changed = await applyConfig({ cwd: options.cwd, force: options.force });
    const major = detectSolidMajor(options.cwd);

    if (changed.length === 0) {
      process.stdout.write("Nothing to do — already set up.\n");
      return;
    }

    for (const path of changed) process.stdout.write(`✓ ${path}\n`);
    process.stdout.write(
      `\nSolid ${major} detected. Run your scripts with \`bun run\` or \`bun test\`; the\n` +
        "preload in bunfig.toml applies to both.\n",
    );
  });

program
  .command("check")
  .description("Report whether this project can compile Solid JSX.")
  .option("-c, --cwd <path>", "Working directory.", process.cwd())
  .action(async (options: { cwd: string }) => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");

    const cwd = resolve(options.cwd);
    const major = detectSolidMajor(cwd);
    const runtime = major === 1 ? "solid-js/web" : "@solidjs/web";

    const problems: string[] = [];
    const lines: string[] = [];

    lines.push(`Solid ${major} (jsxImportSource: ${runtime})`);

    // 1. Is the runtime installed at all?
    try {
      Bun.resolveSync("solid-js/package.json", cwd);
    } catch {
      problems.push("solid-js is not installed — run `bun add solid-js @solidjs/web`");
    }

    // 2. Does tsconfig point at the runtime?
    const tsconfig = join(cwd, "tsconfig.json");
    if (!existsSync(tsconfig)) {
      problems.push("no tsconfig.json — editors will type JSX as React");
    } else if (!readFileSync(tsconfig, "utf8").includes('"jsxImportSource"')) {
      problems.push(`tsconfig.json has no jsxImportSource — set it to "${runtime}"`);
    }

    // 3. Is the plugin preloaded for both `bun run` and `bun test`?
    const bunfig = join(cwd, "bunfig.toml");
    if (!existsSync(bunfig)) {
      problems.push("no bunfig.toml — Bun will fall back to react/jsx-runtime");
    } else {
      const text = readFileSync(bunfig, "utf8");
      if (!text.includes("@prestgg/solid-jsx")) problems.push("bunfig.toml does not preload the plugin");
      if (!text.includes("[test]")) {
        problems.push(
          "bunfig.toml has no [test] section — the top-level preload applies to `bun run` only, so `bun test` will not compile JSX",
        );
      }
    }

    process.stdout.write(`${lines.join("\n")}\n`);

    if (problems.length === 0) {
      process.stdout.write("\n✓ ready\n");
      return;
    }

    process.stdout.write("\nnot ready:\n");
    for (const problem of problems) process.stdout.write(`  • ${problem}\n`);
    process.stdout.write("\nRun `solid-jsx init` to fix what can be fixed automatically.\n");
    process.exitCode = 1;
  });

program.command("preload").description("Print the preload file's contents.").action(() => {
  process.stdout.write(solidPreloadSource());
});

program.parseAsync(process.argv).catch((cause: unknown) => {
  fail(cause instanceof Error ? cause.message : String(cause));
});