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

  it("keeps OpenAI credentials inside the server-only service", () => {
    const roots = [resolve(process.cwd(), "app"), resolve(process.cwd(), "components")];
    const browserSource = roots
      .flatMap(sourceFiles)
      .filter((path) => readFileSync(path, "utf8").includes('"use client"'))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const service = readFileSync(resolve(process.cwd(), "lib/genai/client.ts"), "utf8");

    expect(browserSource).not.toMatch(/process\.env|from ["']@\/lib\/genai\/client["']/);
    expect(service.startsWith('import "server-only";')).toBe(true);
  });
});
