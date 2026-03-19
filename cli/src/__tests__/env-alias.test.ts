import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetPaperclipEnvAliasWarningsForTests, resolvePaperclipEnvValue } from "../config/env-alias.js";

afterEach(() => {
  __resetPaperclipEnvAliasWarningsForTests();
  vi.restoreAllMocks();
});

describe("resolvePaperclipEnvValue", () => {
  it("uses CUBECLOUDIO alias value when present", () => {
    const env = {
      CUBECLOUDIO_API_URL: "http://localhost:4400",
      PAPERCLIP_API_URL: "http://localhost:3100",
    } as NodeJS.ProcessEnv;

    expect(resolvePaperclipEnvValue("PAPERCLIP_API_URL", env)).toBe("http://localhost:4400");
  });

  it("falls back to PAPERCLIP value and emits deprecation warning once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = {
      PAPERCLIP_API_URL: "http://localhost:3100",
    } as NodeJS.ProcessEnv;

    expect(resolvePaperclipEnvValue("PAPERCLIP_API_URL", env)).toBe("http://localhost:3100");
    expect(resolvePaperclipEnvValue("PAPERCLIP_API_URL", env)).toBe("http://localhost:3100");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("PAPERCLIP_API_URL");
    expect(warn.mock.calls[0]?.[0]).toContain("CUBECLOUDIO_API_URL");
  });
});
