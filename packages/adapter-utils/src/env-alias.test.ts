import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetPaperclipEnvAliasWarningsForTests, resolvePaperclipEnvValue } from "./env-alias.js";

afterEach(() => {
  __resetPaperclipEnvAliasWarningsForTests();
  vi.restoreAllMocks();
});

describe("adapter-utils resolvePaperclipEnvValue", () => {
  it("prefers CUBECLOUDIO alias over PAPERCLIP value", () => {
    const env = {
      CUBECLOUDIO_API_URL: "http://localhost:4400",
      PAPERCLIP_API_URL: "http://localhost:3100",
    } as NodeJS.ProcessEnv;

    expect(resolvePaperclipEnvValue("PAPERCLIP_API_URL", env)).toBe("http://localhost:4400");
  });

  it("falls back to PAPERCLIP value and warns once per key", () => {
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

  it("warns separately for each legacy key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = {
      PAPERCLIP_API_URL: "http://localhost:3100",
      PAPERCLIP_API_KEY: "legacy-token",
    } as NodeJS.ProcessEnv;

    expect(resolvePaperclipEnvValue("PAPERCLIP_API_URL", env)).toBe("http://localhost:3100");
    expect(resolvePaperclipEnvValue("PAPERCLIP_API_KEY", env)).toBe("legacy-token");

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toContain("PAPERCLIP_API_URL");
    expect(warn.mock.calls[1]?.[0]).toContain("PAPERCLIP_API_KEY");
  });
});
