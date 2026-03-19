import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeContext } from "../client/context.js";
import { resolveCommandContext } from "../commands/client/common.js";

const ORIGINAL_ENV = { ...process.env };

function createTempPath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-cli-common-"));
  return path.join(dir, name);
}

describe("resolveCommandContext", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.PAPERCLIP_API_URL;
    delete process.env.PAPERCLIP_API_KEY;
    delete process.env.PAPERCLIP_COMPANY_ID;
    delete process.env.CUBECLOUDIO_API_URL;
    delete process.env.CUBECLOUDIO_API_KEY;
    delete process.env.CUBECLOUDIO_COMPANY_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses profile defaults when options/env are not provided", () => {
    const contextPath = createTempPath("context.json");

    writeContext(
      {
        version: 1,
        currentProfile: "ops",
        profiles: {
          ops: {
            apiBase: "http://127.0.0.1:9999",
            companyId: "company-profile",
            apiKeyEnvVarName: "AGENT_KEY",
          },
        },
      },
      contextPath,
    );
    process.env.AGENT_KEY = "key-from-env";

    const resolved = resolveCommandContext({ context: contextPath }, { requireCompany: true });
    expect(resolved.api.apiBase).toBe("http://127.0.0.1:9999");
    expect(resolved.companyId).toBe("company-profile");
    expect(resolved.api.apiKey).toBe("key-from-env");
  });

  it("prefers explicit options over profile values", () => {
    const contextPath = createTempPath("context.json");
    writeContext(
      {
        version: 1,
        currentProfile: "default",
        profiles: {
          default: {
            apiBase: "http://profile:3100",
            companyId: "company-profile",
          },
        },
      },
      contextPath,
    );

    const resolved = resolveCommandContext(
      {
        context: contextPath,
        apiBase: "http://override:3200",
        apiKey: "direct-token",
        companyId: "company-override",
      },
      { requireCompany: true },
    );

    expect(resolved.api.apiBase).toBe("http://override:3200");
    expect(resolved.companyId).toBe("company-override");
    expect(resolved.api.apiKey).toBe("direct-token");
  });

  it("throws when company is required but unresolved", () => {
    const contextPath = createTempPath("context.json");
    writeContext(
      {
        version: 1,
        currentProfile: "default",
        profiles: { default: {} },
      },
      contextPath,
    );

    expect(() =>
      resolveCommandContext({ context: contextPath, apiBase: "http://localhost:3100" }, { requireCompany: true }),
    ).toThrow(/Company ID is required/);
  });

  it("uses CUBECLOUDIO env aliases when PAPERCLIP env vars are absent", () => {
    process.env.CUBECLOUDIO_API_URL = "http://localhost:3900";
    process.env.CUBECLOUDIO_API_KEY = "cube-token";
    process.env.CUBECLOUDIO_COMPANY_ID = "company-cube";

    const resolved = resolveCommandContext({}, { requireCompany: true });

    expect(resolved.api.apiBase).toBe("http://localhost:3900");
    expect(resolved.api.apiKey).toBe("cube-token");
    expect(resolved.companyId).toBe("company-cube");
  });

  it("prefers CUBECLOUDIO env aliases over PAPERCLIP env vars", () => {
    process.env.PAPERCLIP_API_URL = "http://localhost:3100";
    process.env.PAPERCLIP_API_KEY = "paperclip-token";
    process.env.PAPERCLIP_COMPANY_ID = "company-paperclip";
    process.env.CUBECLOUDIO_API_URL = "http://localhost:4900";
    process.env.CUBECLOUDIO_API_KEY = "cube-token";
    process.env.CUBECLOUDIO_COMPANY_ID = "company-cube";

    const resolved = resolveCommandContext({}, { requireCompany: true });

    expect(resolved.api.apiBase).toBe("http://localhost:4900");
    expect(resolved.api.apiKey).toBe("cube-token");
    expect(resolved.companyId).toBe("company-cube");
  });
});
