import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecutionConnectorModule } from "@paperclipai/shared";
import {
  createExecutionConnectorRegistry,
  findExecutionConnectorByAdapterType,
  listExecutionConnectorDefinitions,
  testExecutionConnector,
} from "../connectors/index.js";

describe("execution connector registry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the built-in IronClaw connector", () => {
    const connector = findExecutionConnectorByAdapterType("ironclaw_gateway");
    expect(connector?.definition.key).toBe("ironclaw_gateway");

    const definitions = listExecutionConnectorDefinitions();
    expect(definitions.some((definition) => definition.key === "ironclaw_gateway")).toBe(true);
  });

  it("supports register and unregister on a custom registry", () => {
    const registry = createExecutionConnectorRegistry();
    const module: ExecutionConnectorModule = {
      definition: {
        key: "mock_connector",
        adapterType: "mock_adapter",
        label: "Mock Connector",
        transport: "http",
        operations: ["job"],
        capabilities: {
          supportsJobs: true,
          supportsRoutines: false,
          supportsSessions: false,
        },
      },
    };

    registry.registerConnector(module);
    expect(registry.getConnector("mock_connector")?.definition.label).toBe("Mock Connector");
    expect(registry.findConnectorByAdapterType("mock_adapter")?.definition.key).toBe("mock_connector");

    expect(registry.unregisterConnector("mock_connector")).toBe(true);
    expect(registry.getConnector("mock_connector")).toBeNull();
  });

  it("returns healthy when the IronClaw gateway responds to health and status checks", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "healthy", channel: "gateway" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ gateway: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await testExecutionConnector("ironclaw_gateway", {
      baseUrl: "http://ironclaw.local:3000",
      authToken: "secret-token",
    });

    expect(result.status).toBe("healthy");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});