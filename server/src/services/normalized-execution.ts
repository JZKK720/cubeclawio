import type {
  CompanyExecutionConnector,
  ExecutionConnectorDefinition,
  ExecutionConnectorHealth,
  ExecutionRoutineReference,
  ExecutionRoutineRunSummary,
  ExecutionRoutineSummary,
  ExternalExecutionRef,
  NormalizedExecutionArtifact,
  NormalizedExecutionRun,
} from "@cubeclawio/shared";
import {
  getExecutionConnector,
  listExecutionConnectorDefinitions,
  listExecutionConnectorsByOperation,
} from "../connectors/index.js";
import { badRequest, notFound } from "../errors.js";
import type { Db } from "@cubeclawio/db";
import { executionConnectorConfigService } from "./execution-connector-configs.js";
import { executionEventService } from "./execution-events.js";

export interface NormalizedExecutionService {
  listConnectorDefinitions(): ExecutionConnectorDefinition[];
  listCompanyConnectors(companyId: string): Promise<CompanyExecutionConnector[]>;
  testConnector(input: { companyId: string; key: string; config?: Record<string, unknown> }): Promise<ExecutionConnectorHealth>;
  listRuns(input: { companyId: string; connectorKey?: string }): Promise<NormalizedExecutionRun[]>;
  getRun(input: { companyId: string; connectorKey: string; runId: string }): Promise<NormalizedExecutionRun | null>;
  cancelRun(input: { companyId: string; connectorKey: string; runId: string }): Promise<{ ok: boolean; message?: string }>;
  restartRun(input: { companyId: string; connectorKey: string; runId: string }): Promise<NormalizedExecutionRun>;
  promptRun(input: { companyId: string; connectorKey: string; runId: string; prompt: string }): Promise<{ ok: boolean; message?: string }>;
  listRunArtifacts(input: { companyId: string; connectorKey: string; runId: string }): Promise<NormalizedExecutionArtifact[]>;
  listRunEvents(input: { companyId: string; connectorKey: string; runId: string; afterSeq?: number; limit?: number }): Promise<import("@cubeclawio/shared").NormalizedExecutionRunEvent[]>;
  listRoutines(input: { companyId: string; connectorKey?: string }): Promise<ExecutionRoutineSummary[]>;
  getRoutine(input: { companyId: string; connectorKey: string; routineId: string }): Promise<ExecutionRoutineSummary | null>;
  listRoutineRuns(input: { companyId: string; connectorKey: string; routineId: string }): Promise<ExecutionRoutineRunSummary[]>;
  triggerRoutine(input: { companyId: string; connectorKey: string; routineId: string }): Promise<{ ok: boolean; run?: NormalizedExecutionRun | null }>;
  setRoutineEnabled(input: { companyId: string; connectorKey: string; routineId: string; enabled: boolean }): Promise<{ ok: boolean; enabled: boolean }>;
  deleteRoutine(input: { companyId: string; connectorKey: string; routineId: string }): Promise<{ ok: boolean }>;
}

function buildRunRef(companyId: string, connectorKey: string, runId: string): ExternalExecutionRef {
  return {
    connectorKey,
    provider: connectorKey,
    jobId: runId,
    metadata: {
      companyId,
    },
  };
}

function attachConnectorConfig(ref: ExternalExecutionRef, connectorConfig: Record<string, unknown>): ExternalExecutionRef {
  return {
    ...ref,
    metadata: {
      ...(ref.metadata ?? {}),
      connectorConfig,
    },
  };
}

function buildRoutineRef(companyId: string, connectorKey: string, routineId: string): ExecutionRoutineReference & {
  metadata: Record<string, unknown>;
} {
  return {
    connectorKey,
    routineId,
    metadata: {
      companyId,
    },
  };
}

function requireConnector(key: string) {
  const connector = getExecutionConnector(key);
  if (!connector) throw notFound(`Unknown execution connector: ${key}`);
  return connector;
}

export function normalizedExecutionService(db: Db): NormalizedExecutionService {
  const connectorConfigs = executionConnectorConfigService(db);
  const executionEvents = executionEventService(db);

  return {
    listConnectorDefinitions() {
      return listExecutionConnectorDefinitions();
    },

    listCompanyConnectors(companyId) {
      return connectorConfigs.list(companyId);
    },

    testConnector(input) {
      return connectorConfigs.test(input.companyId, input.key, input.config);
    },

    async listRuns(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connectors = input.connectorKey
        ? [requireConnector(input.connectorKey)]
        : listExecutionConnectorsByOperation("job");

      const runs = await Promise.all(
        connectors.map(async (connector) => {
          if (!connector.jobs?.listJobs) return [];
          const connectorConfig = await connectorConfigs.resolveRuntimeConfig(
            input.companyId,
            connector.definition.key,
            { allowMissing: true },
          );
          if (!connectorConfig) return [];
          return connector.jobs.listJobs({ companyId: input.companyId, connectorConfig });
        }),
      );

      return runs.flat();
    },

    async getRun(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connector = requireConnector(input.connectorKey);
      if (!connector.jobs?.getJob) throw badRequest(`Connector ${input.connectorKey} does not support job detail`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.jobs.getJob(attachConnectorConfig(buildRunRef(input.companyId, input.connectorKey, input.runId), connectorConfig!));
    },

    async cancelRun(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connector = requireConnector(input.connectorKey);
      if (!connector.jobs?.cancelJob) throw badRequest(`Connector ${input.connectorKey} does not support job cancellation`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.jobs.cancelJob(attachConnectorConfig(buildRunRef(input.companyId, input.connectorKey, input.runId), connectorConfig!));
    },

    async restartRun(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connector = requireConnector(input.connectorKey);
      if (!connector.jobs?.restartJob) throw badRequest(`Connector ${input.connectorKey} does not support job restart`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.jobs.restartJob(attachConnectorConfig(buildRunRef(input.companyId, input.connectorKey, input.runId), connectorConfig!));
    },

    async promptRun(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connector = requireConnector(input.connectorKey);
      if (!connector.jobs?.sendJobPrompt) throw badRequest(`Connector ${input.connectorKey} does not support job prompt updates`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.jobs.sendJobPrompt({
        runId: input.runId,
        prompt: input.prompt,
        metadata: {
          companyId: input.companyId,
          jobId: input.runId,
          connectorConfig,
        },
      });
    },

    async listRunArtifacts(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connector = requireConnector(input.connectorKey);
      if (!connector.jobs?.listJobArtifacts) return [];
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.jobs.listJobArtifacts(attachConnectorConfig(buildRunRef(input.companyId, input.connectorKey, input.runId), connectorConfig!));
    },

    listRunEvents(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      return executionEvents.listAfterSync(
        input.companyId,
        input.connectorKey,
        input.runId,
        input.afterSeq ?? 0,
        input.limit ?? 200,
      );
    },

    async listRoutines(input) {
      if (!input.companyId) throw badRequest("companyId is required");
      const connectors = input.connectorKey
        ? [requireConnector(input.connectorKey)]
        : listExecutionConnectorsByOperation("routine");

      const routines = await Promise.all(
        connectors.map(async (connector) => {
          if (!connector.routines?.listRoutines) return [];
          const connectorConfig = await connectorConfigs.resolveRuntimeConfig(
            input.companyId,
            connector.definition.key,
            { allowMissing: true },
          );
          if (!connectorConfig) return [];
          return connector.routines.listRoutines({ companyId: input.companyId, connectorConfig });
        }),
      );

      return routines.flat();
    },

    async getRoutine(input) {
      const connector = requireConnector(input.connectorKey);
      if (!connector.routines?.getRoutine) throw badRequest(`Connector ${input.connectorKey} does not support routine detail`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.routines.getRoutine({
        ...buildRoutineRef(input.companyId, input.connectorKey, input.routineId),
        metadata: {
          companyId: input.companyId,
          connectorConfig,
        },
      });
    },

    async listRoutineRuns(input) {
      const connector = requireConnector(input.connectorKey);
      if (!connector.routines?.listRoutineRuns) return [];
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.routines.listRoutineRuns({
        ...buildRoutineRef(input.companyId, input.connectorKey, input.routineId),
        metadata: {
          companyId: input.companyId,
          connectorConfig,
        },
      });
    },

    async triggerRoutine(input) {
      const connector = requireConnector(input.connectorKey);
      if (!connector.routines?.triggerRoutine) throw badRequest(`Connector ${input.connectorKey} does not support manual routine triggering`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.routines.triggerRoutine({
        ...buildRoutineRef(input.companyId, input.connectorKey, input.routineId),
        metadata: {
          companyId: input.companyId,
          connectorConfig,
        },
      });
    },

    async setRoutineEnabled(input) {
      const connector = requireConnector(input.connectorKey);
      if (!connector.routines?.setRoutineEnabled) throw badRequest(`Connector ${input.connectorKey} does not support routine toggle`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.routines.setRoutineEnabled(
        {
          ...buildRoutineRef(input.companyId, input.connectorKey, input.routineId),
          metadata: {
            companyId: input.companyId,
            connectorConfig,
          },
        },
        input.enabled,
      );
    },

    async deleteRoutine(input) {
      const connector = requireConnector(input.connectorKey);
      if (!connector.routines?.deleteRoutine) throw badRequest(`Connector ${input.connectorKey} does not support routine deletion`);
      const connectorConfig = await connectorConfigs.resolveRuntimeConfig(input.companyId, input.connectorKey, { allowMissing: false });
      return connector.routines.deleteRoutine({
        ...buildRoutineRef(input.companyId, input.connectorKey, input.routineId),
        metadata: {
          companyId: input.companyId,
          connectorConfig,
        },
      });
    },
  };
}