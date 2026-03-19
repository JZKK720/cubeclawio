import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolvePaperclipHomeDir, resolvePaperclipInstanceId } from "../home-paths.js";
import { resolvePaperclipConfigPath } from "../paths.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("server env aliases", () => {
  it("uses CUBECLOUDIO_HOME and CUBECLOUDIO_INSTANCE_ID aliases", () => {
    delete process.env.PAPERCLIP_HOME;
    delete process.env.PAPERCLIP_INSTANCE_ID;
    process.env.CUBECLOUDIO_HOME = "~/cubecloudio-home";
    process.env.CUBECLOUDIO_INSTANCE_ID = "cube_server";

    expect(resolvePaperclipHomeDir()).toBe(path.resolve(os.homedir(), "cubecloudio-home"));
    expect(resolvePaperclipInstanceId()).toBe("cube_server");
  });

  it("prefers CUBECLOUDIO_CONFIG alias over PAPERCLIP_CONFIG", () => {
    process.env.PAPERCLIP_CONFIG = "/tmp/paperclip-config.json";
    process.env.CUBECLOUDIO_CONFIG = "/tmp/cubecloudio-config.json";

    expect(resolvePaperclipConfigPath()).toBe(path.resolve("/tmp/cubecloudio-config.json"));
  });
});
