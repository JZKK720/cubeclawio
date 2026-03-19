import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetPaperclipEnvAliasWarningsForTests, resolvePaperclipEnvValue } from "../env-alias.js";

afterEach(() => {
  __resetPaperclipEnvAliasWarningsForTests();
  vi.restoreAllMocks();
});

describe("server resolvePaperclipEnvValue", () => {
  it("uses CUBECLOUDIO alias value when present", () => {
    const env = {
      CUBECLOUDIO_CONFIG: "/tmp/cubecloudio-config.json",
      PAPERCLIP_CONFIG: "/tmp/paperclip-config.json",
    } as NodeJS.ProcessEnv;

    expect(resolvePaperclipEnvValue("PAPERCLIP_CONFIG", env)).toBe("/tmp/cubecloudio-config.json");
  });

  it("falls back to PAPERCLIP value and warns once per key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = {
      PAPERCLIP_CONFIG: "/tmp/paperclip-config.json",
    } as NodeJS.ProcessEnv;

    expect(resolvePaperclipEnvValue("PAPERCLIP_CONFIG", env)).toBe("/tmp/paperclip-config.json");
    expect(resolvePaperclipEnvValue("PAPERCLIP_CONFIG", env)).toBe("/tmp/paperclip-config.json");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("PAPERCLIP_CONFIG");
    expect(warn.mock.calls[0]?.[0]).toContain("CUBECLOUDIO_CONFIG");
  });
});
