import type {
  ExecutionConnectorDefinition,
  ExecutionConnectorHealth,
  ExecutionConnectorModule,
  ExecutionConnectorOperationKind,
} from "@cubeclawio/shared";
import { ironclawGatewayConnector } from "./ironclaw-gateway.js";

export interface ExecutionConnectorRegistry {
  registerConnector(module: ExecutionConnectorModule): void;
  unregisterConnector(key: string): boolean;
  getConnector(key: string): ExecutionConnectorModule | null;
  findConnectorByAdapterType(adapterType: string): ExecutionConnectorModule | null;
  listConnectors(): ExecutionConnectorModule[];
  listConnectorDefinitions(): ExecutionConnectorDefinition[];
  listConnectorsByOperation(kind: ExecutionConnectorOperationKind): ExecutionConnectorModule[];
  testConnector(key: string, config: Record<string, unknown>): Promise<ExecutionConnectorHealth>;
}

const DEFAULT_TEST_RESULT: ExecutionConnectorHealth = {
  status: "unknown",
  testedAt: new Date(0).toISOString(),
  message: "Connector does not provide a health check.",
};

export function createExecutionConnectorRegistry(
  modules: ExecutionConnectorModule[] = [],
): ExecutionConnectorRegistry {
  const connectorsByKey = new Map<string, ExecutionConnectorModule>();
  const connectorKeyByAdapterType = new Map<string, string>();

  const registerConnector = (module: ExecutionConnectorModule): void => {
    connectorsByKey.set(module.definition.key, module);
    connectorKeyByAdapterType.set(module.definition.adapterType, module.definition.key);
  };

  for (const module of modules) {
    registerConnector(module);
  }

  return {
    registerConnector,

    unregisterConnector(key: string): boolean {
      const existing = connectorsByKey.get(key);
      if (!existing) return false;
      connectorsByKey.delete(key);
      connectorKeyByAdapterType.delete(existing.definition.adapterType);
      return true;
    },

    getConnector(key: string): ExecutionConnectorModule | null {
      return connectorsByKey.get(key) ?? null;
    },

    findConnectorByAdapterType(adapterType: string): ExecutionConnectorModule | null {
      const key = connectorKeyByAdapterType.get(adapterType);
      return key ? connectorsByKey.get(key) ?? null : null;
    },

    listConnectors(): ExecutionConnectorModule[] {
      return Array.from(connectorsByKey.values());
    },

    listConnectorDefinitions(): ExecutionConnectorDefinition[] {
      return Array.from(connectorsByKey.values(), (module) => module.definition);
    },

    listConnectorsByOperation(kind: ExecutionConnectorOperationKind): ExecutionConnectorModule[] {
      return Array.from(connectorsByKey.values()).filter((module) => module.definition.operations.includes(kind));
    },

    async testConnector(key: string, config: Record<string, unknown>): Promise<ExecutionConnectorHealth> {
      const module = connectorsByKey.get(key);
      if (!module) {
        return {
          status: "unknown",
          testedAt: new Date().toISOString(),
          message: `Unknown connector: ${key}`,
          detail: {
            code: "execution_connector_not_found",
          },
        };
      }

      if (!module.testConnector) {
        return {
          ...DEFAULT_TEST_RESULT,
          testedAt: new Date().toISOString(),
          detail: {
            code: "execution_connector_health_not_implemented",
            connectorKey: key,
          },
        };
      }

      return module.testConnector(config);
    },
  };
}

export const executionConnectorRegistry = createExecutionConnectorRegistry([
  ironclawGatewayConnector,
]);

export function getExecutionConnector(key: string): ExecutionConnectorModule | null {
  return executionConnectorRegistry.getConnector(key);
}

export function findExecutionConnectorByAdapterType(adapterType: string): ExecutionConnectorModule | null {
  return executionConnectorRegistry.findConnectorByAdapterType(adapterType);
}

export function listExecutionConnectors(): ExecutionConnectorModule[] {
  return executionConnectorRegistry.listConnectors();
}

export function listExecutionConnectorDefinitions(): ExecutionConnectorDefinition[] {
  return executionConnectorRegistry.listConnectorDefinitions();
}

export function listExecutionConnectorsByOperation(
  kind: ExecutionConnectorOperationKind,
): ExecutionConnectorModule[] {
  return executionConnectorRegistry.listConnectorsByOperation(kind);
}

export async function testExecutionConnector(
  key: string,
  config: Record<string, unknown>,
): Promise<ExecutionConnectorHealth> {
  return executionConnectorRegistry.testConnector(key, config);
}