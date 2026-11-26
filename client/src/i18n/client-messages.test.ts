import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_NAMESPACES, pickClientMessages } from "./client-messages";

const SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "vendor" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("client next-intl namespaces", () => {
  it("covers every namespace client code reads with useTranslations", () => {
    const used = new Set<string>();
    for (const file of sourceFiles(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/useTranslations\(\s*["'](\w+)/g)) {
        used.add(m[1]!);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((ns) => !(CLIENT_NAMESPACES as readonly string[]).includes(ns))).toEqual([]);
  });

  it("sends only those namespaces", () => {
    expect(pickClientMessages({ agents: { a: "A" }, blast: { b: "B" } })).toEqual({ agents: { a: "A" } });
  });
});
