import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("rendering security boundary", () => {
  it("does not use raw HTML injection APIs in app or component code", () => {
    const roots = [resolve(process.cwd(), "app"), resolve(process.cwd(), "components")];
    const source = roots
      .flatMap(sourceFiles)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    expect(source).not.toMatch(/dangerouslySetInnerHTML|\binnerHTML\b/);
  });
});
