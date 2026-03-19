import { afterEach, describe, expect, it } from "vitest";
import { buildPaperclipEnv } from "../adapters/utils.js";

const ORIGINAL_PAPERCLIP_API_URL = process.env.PAPERCLIP_API_URL;
const ORIGINAL_CUBECLOUDIO_API_URL = process.env.CUBECLOUDIO_API_URL;
const ORIGINAL_PAPERCLIP_LISTEN_HOST = process.env.PAPERCLIP_LISTEN_HOST;
const ORIGINAL_CUBECLOUDIO_LISTEN_HOST = process.env.CUBECLOUDIO_LISTEN_HOST;
const ORIGINAL_PAPERCLIP_LISTEN_PORT = process.env.PAPERCLIP_LISTEN_PORT;
const ORIGINAL_CUBECLOUDIO_LISTEN_PORT = process.env.CUBECLOUDIO_LISTEN_PORT;
const ORIGINAL_HOST = process.env.HOST;
const ORIGINAL_PORT = process.env.PORT;

afterEach(() => {
  if (ORIGINAL_PAPERCLIP_API_URL === undefined) delete process.env.PAPERCLIP_API_URL;
  else process.env.PAPERCLIP_API_URL = ORIGINAL_PAPERCLIP_API_URL;

  if (ORIGINAL_CUBECLOUDIO_API_URL === undefined) delete process.env.CUBECLOUDIO_API_URL;
  else process.env.CUBECLOUDIO_API_URL = ORIGINAL_CUBECLOUDIO_API_URL;

  if (ORIGINAL_PAPERCLIP_LISTEN_HOST === undefined) delete process.env.PAPERCLIP_LISTEN_HOST;
  else process.env.PAPERCLIP_LISTEN_HOST = ORIGINAL_PAPERCLIP_LISTEN_HOST;

  if (ORIGINAL_CUBECLOUDIO_LISTEN_HOST === undefined) delete process.env.CUBECLOUDIO_LISTEN_HOST;
  else process.env.CUBECLOUDIO_LISTEN_HOST = ORIGINAL_CUBECLOUDIO_LISTEN_HOST;

  if (ORIGINAL_PAPERCLIP_LISTEN_PORT === undefined) delete process.env.PAPERCLIP_LISTEN_PORT;
  else process.env.PAPERCLIP_LISTEN_PORT = ORIGINAL_PAPERCLIP_LISTEN_PORT;

  if (ORIGINAL_CUBECLOUDIO_LISTEN_PORT === undefined) delete process.env.CUBECLOUDIO_LISTEN_PORT;
  else process.env.CUBECLOUDIO_LISTEN_PORT = ORIGINAL_CUBECLOUDIO_LISTEN_PORT;

  if (ORIGINAL_HOST === undefined) delete process.env.HOST;
  else process.env.HOST = ORIGINAL_HOST;

  if (ORIGINAL_PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL_PORT;
});

describe("buildPaperclipEnv", () => {
  it("prefers an explicit PAPERCLIP_API_URL", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:4100";
    delete process.env.CUBECLOUDIO_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "127.0.0.1";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:4100");
  });

  it("uses runtime listen host/port when explicit URL is not set", () => {
    delete process.env.PAPERCLIP_API_URL;
    delete process.env.CUBECLOUDIO_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "0.0.0.0";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";
    process.env.PORT = "3100";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:3101");
  });

  it("formats IPv6 hosts safely in fallback URL generation", () => {
    delete process.env.PAPERCLIP_API_URL;
    delete process.env.CUBECLOUDIO_API_URL;
    process.env.PAPERCLIP_LISTEN_HOST = "::1";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://[::1]:3101");
  });

  it("uses CUBECLOUDIO_API_URL alias when PAPERCLIP_API_URL is not set", () => {
    delete process.env.PAPERCLIP_API_URL;
    process.env.CUBECLOUDIO_API_URL = "http://localhost:5200";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:5200");
  });

  it("prefers CUBECLOUDIO aliases over PAPERCLIP values when both are set", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:4100";
    process.env.CUBECLOUDIO_API_URL = "http://localhost:5300";
    process.env.PAPERCLIP_LISTEN_HOST = "127.0.0.1";
    process.env.CUBECLOUDIO_LISTEN_HOST = "localhost";
    process.env.PAPERCLIP_LISTEN_PORT = "3101";
    process.env.CUBECLOUDIO_LISTEN_PORT = "5400";

    const env = buildPaperclipEnv({ id: "agent-1", companyId: "company-1" });

    expect(env.PAPERCLIP_API_URL).toBe("http://localhost:5300");
  });
});
