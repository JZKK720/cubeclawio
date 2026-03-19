import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe("CLI command alias metadata", () => {
  it("publishes cubecloud.io as primary bin and paperclipai as compatibility alias", () => {
    const packageJsonPath = path.resolve(testDir, "../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      bin?: Record<string, string>;
    };

    expect(packageJson.bin?.["cubecloud.io"]).toBe("./dist/index.js");
    expect(packageJson.bin?.paperclipai).toBe("./dist/index.js");
  });

  it("sets cubecloud.io as the runtime command name", () => {
    const indexPath = path.resolve(testDir, "../index.ts");
    const source = fs.readFileSync(indexPath, "utf8");

    expect(source).toContain('.name("cubecloud.io")');
  });
});
