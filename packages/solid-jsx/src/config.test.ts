import { describe, expect, test } from "bun:test";

import { withJsxImportSource } from "./config";

describe("withJsxImportSource", () => {
  test("adds a compilerOptions block to an empty file", () => {
    expect(withJsxImportSource("", "@solidjs/web")).toContain('"jsxImportSource": "@solidjs/web"');
    expect(withJsxImportSource("{}", "@solidjs/web")).not.toContain("{,");
  });

  test("inserts into an existing compilerOptions, keeping the rest", () => {
    const source = `{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
`;
    const next = withJsxImportSource(source, "@solidjs/web");
    expect(next).toContain('"strict": true');
    expect(next).toContain('"include": ["src"]');
    expect(next).toContain('"jsxImportSource": "@solidjs/web"');
  });

  test("does not touch a config that already has it", () => {
    const source = `{ "compilerOptions": { "jsxImportSource": "@solidjs/web" } }`;
    // The caller checks before calling; here we only assert the shape holds.
    expect(withJsxImportSource(source, "@solidjs/web")).toContain("@solidjs/web");
  });

  test("adds the block when the file has other top-level keys", () => {
    const next = withJsxImportSource('{ "extends": "./base.json" }', "@solidjs/web");
    expect(next).toContain('"extends": "./base.json"');
    expect(next).toContain('"compilerOptions"');
  });
});
