import { and, eq } from "drizzle-orm";
import type { Db } from "@cubeclawio/db";
import { executionConnectorConfigs } from "@cubeclawio/db";
import type {
  CompanyExecutionConnector,
  CompanyExecutionConnectorConfig,
  ExecutionConnectorHealth,
  IronclawGatewayConnectorConfig,
  IronclawGatewayPersistentConfig,
} from "@cubeclawio/shared";
import { ironclawGatewayPersistentConfigSchema } from "@cubeclawio/shared";
import { getExecutionConnector, listExecutionConnectorDefinitions, testExecutionConnector } from "../connectors/index.js";
import { badRequest, notFound } from "../errors.js";
import { secretService } from "./secrets.js";

type ExecutionConnectorConfigRow = typeof executionConnectorConfigs.$inferSelect;

function asConfigRecord(row: ExecutionConnectorConfigRow): CompanyExecutionConnectorConfig {
  return {
    id: row.id,
    companyId: row.companyId,
    connectorKey: row.connectorKey,
    enabled: row.enabled,
    config: row.configJson ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasIronclawRuntimeConfig(config: Record<string, unknown>): boolean {
  return typeof config.baseUrl === "string" && config.baseUrl.trim().length > 0 && typeof config.authToken === "object";
}

export function executionConnectorConfigService(db: Db) {
  const secrets = secretService(db);

  async function getRow(companyId: string, connectorKey: string) {
    return db
      .select()
      .from(executionConnectorConfigs)
      .where(
        and(
          eq(executionConnectorConfigs.companyId, companyId),
          eq(executionConnectorConfigs.connectorKey, connectorKey),
        ),
      )
      .then((rows) => rows[0] ?? null);
  }

  async function normalizeConfig(
    companyId: string,
    connectorKey: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (connectorKey) {
      case "ironclaw_gateway": {
        const parsed = ironclawGatewayPersistentConfigSchema.safeParse(input);
        if (!parsed.success) {
          throw badRequest(parsed.error.issues[0]?.message ?? "Invalid IronClaw connector config");
        }
        const config: IronclawGatewayPersistentConfig = parsed.data;
        return {
          ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
          ...(config.authToken
            ? { authToken: await secrets.normalizeBindingForPersistence(companyId, config.authToken, { requireSecretRef: true }) }
            : {}),
          ...(typeof config.timeoutMs === "number" ? { timeoutMs: config.timeoutMs } : {}),
          ...(config.userId ? { userId: config.userId } : {}),
          ...(config.metadata ? { metadata: config.metadata } : {}),
        };
      }
      default:
        if (!getExecutionConnector(connectorKey)) {
          throw notFound(`Unknown execution connector: ${connectorKey}`);
        }
        return input;
    }
  }

  async function resolveRuntimeConfig(companyId: string, connectorKey: string, opts?: { allowMissing?: boolean }) {
    const row = await getRow(companyId, connectorKey);
    if (!row || !row.enabled) {
      if (opts?.allowMissing) return null;
      throw badRequest(`Connector ${connectorKey} is not configured for this company`);
    }

    switch (connectorKey) {
      case "ironclaw_gateway": {
        const config = row.configJson ?? {};
        const baseUrl = typeof config.baseUrl === "string" ? config.baseUrl.trim() : "";
        if (!baseUrl) {
          if (opts?.allowMissing) return null;
          throw badRequest("IronClaw connector baseUrl is required");
        }
        if (!("authToken" in config)) {
          if (opts?.allowMissing) return null;
          throw badRequest("IronClaw connector authToken secret is required");
        }
        const authToken = await secrets.resolveBindingValue(companyId, config.authToken);
        const runtimeConfig: IronclawGatewayConnectorConfig = {
          baseUrl,
          authToken,
          ...(typeof config.timeoutMs === "number" ? { timeoutMs: config.timeoutMs } : {}),
          ...(typeof config.userId === "string" ? { userId: config.userId } : {}),
          ...(isRecord(config.metadata) ? { metadata: config.metadata } : {}),
        };
        return runtimeConfig as unknown as Record<string, unknown>;
      }
      default:
        return row.configJson ?? {};
    }
  }

  return {
    async list(companyId: string): Promise<CompanyExecutionConnector[]> {
      const rows = await db
        .select()
        .from(executionConnectorConfigs)
        .where(eq(executionConnectorConfigs.companyId, companyId));

      const byKey = new Map(rows.map((row) => [row.connectorKey, row]));
      return listExecutionConnectorDefinitions().map((definition) => {
        const row = byKey.get(definition.key) ?? null;
        const config = row ? asConfigRecord(row) : null;
        const isConfigured = config
          ? definition.key === "ironclaw_gateway"
            ? config.enabled && hasIronclawRuntimeConfig(config.config)
            : config.enabled
          : false;

        return {
          definition,
          config,
          isConfigured,
        };
      });
    },

    async get(companyId: string, connectorKey: string) {
      const row = await getRow(companyId, connectorKey);
      return row ? asConfigRecord(row) : null;
    },

    async upsert(companyId: string, connectorKey: string, input: { enabled?: boolean; config?: Record<string, unknown> }) {
      if (!getExecutionConnector(connectorKey)) {
        throw notFound(`Unknown execution connector: ${connectorKey}`);
      }

      const existing = await getRow(companyId, connectorKey);
      const nextConfig = await normalizeConfig(companyId, connectorKey, input.config ?? existing?.configJson ?? {});
      const nextEnabled = input.enabled ?? existing?.enabled ?? true;

      if (existing) {
        return db
          .update(executionConnectorConfigs)
          .set({
            enabled: nextEnabled,
            configJson: nextConfig,
            updatedAt: new Date(),
          })
          .where(eq(executionConnectorConfigs.id, existing.id))
          .returning()
          .then((rows) => asConfigRecord(rows[0]!));
      }

      return db
        .insert(executionConnectorConfigs)
        .values({
          companyId,
          connectorKey,
          enabled: nextEnabled,
          configJson: nextConfig,
        })
        .returning()
        .then((rows) => asConfigRecord(rows[0]!));
    },

    async remove(companyId: string, connectorKey: string) {
      const row = await getRow(companyId, connectorKey);
      if (!row) return null;
      await db.delete(executionConnectorConfigs).where(eq(executionConnectorConfigs.id, row.id));
      return asConfigRecord(row);
    },

    resolveRuntimeConfig,

    async test(companyId: string, connectorKey: string, configOverride?: Record<string, unknown>): Promise<ExecutionConnectorHealth> {
      const connector = getExecutionConnector(connectorKey);
      if (!connector) throw notFound(`Unknown execution connector: ${connectorKey}`);
      const baseConfig = await resolveRuntimeConfig(companyId, connectorKey, { allowMissing: true });
      const mergedInput = {
        ...(baseConfig ?? {}),
        ...(configOverride ?? {}),
      };
      const normalized = await normalizeConfig(companyId, connectorKey, mergedInput);
      const runtimeConfig = connectorKey === "ironclaw_gateway"
        ? await resolveRuntimeConfig(companyId, connectorKey, { allowMissing: false })
        : normalized;
      if (connectorKey !== "ironclaw_gateway") {
        return testExecutionConnector(connectorKey, runtimeConfig ?? normalized);
      }
      const overrideRuntime: Record<string, unknown> = {
        ...(runtimeConfig ?? {}),
      };
      if (configOverride && isRecord(configOverride)) {
        if (typeof configOverride.baseUrl === "string") overrideRuntime.baseUrl = configOverride.baseUrl;
        if (typeof configOverride.timeoutMs === "number") overrideRuntime.timeoutMs = configOverride.timeoutMs;
        if (typeof configOverride.userId === "string") overrideRuntime.userId = configOverride.userId;
        if (isRecord(configOverride.metadata)) overrideRuntime.metadata = configOverride.metadata;
        if (configOverride.authToken) {
          overrideRuntime.authToken = await secrets.resolveBindingValue(companyId, configOverride.authToken);
        }
      }
      return testExecutionConnector(connectorKey, overrideRuntime);
    },
  };
}