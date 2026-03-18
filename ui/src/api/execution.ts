import type {
  CompanyExecutionConnector,
  CompanyExecutionConnectorConfig,
  ExecutionConnectorHealth,
  ExecutionRoutineRunSummary,
  ExecutionRoutineSummary,
  NormalizedExecutionArtifact,
  NormalizedExecutionRun,
  NormalizedExecutionRunEvent,
} from "@paperclipai/shared";
import { api } from "./client";

type ConnectorConfigInput = {
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export const executionApi = {
  listConnectors: (companyId: string) =>
    api.get<{ connectors: CompanyExecutionConnector[] }>(`/execution/companies/${companyId}/connectors`),
  saveConnector: (companyId: string, connectorKey: string, body: ConnectorConfigInput) =>
    api.put<CompanyExecutionConnectorConfig>(`/execution/companies/${companyId}/connectors/${connectorKey}`, body),
  removeConnector: (companyId: string, connectorKey: string) =>
    api.delete<{ ok: true }>(`/execution/companies/${companyId}/connectors/${connectorKey}`),
  testConnector: (companyId: string, connectorKey: string, config?: Record<string, unknown>) =>
    api.post<ExecutionConnectorHealth>(`/execution/companies/${companyId}/connectors/${connectorKey}/test`, {
      ...(config ? { config } : {}),
    }),
  listRuns: (companyId: string, connectorKey?: string) =>
    api.get<{ runs: NormalizedExecutionRun[] }>(
      `/execution/runs?companyId=${encodeURIComponent(companyId)}${connectorKey ? `&connectorKey=${encodeURIComponent(connectorKey)}` : ""}`,
    ),
  getRun: (companyId: string, connectorKey: string, runId: string) =>
    api.get<NormalizedExecutionRun>(
      `/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}?companyId=${encodeURIComponent(companyId)}`,
    ),
  cancelRun: (companyId: string, connectorKey: string, runId: string) =>
    api.post<{ ok: boolean; message?: string }>(
      `/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}/cancel`,
      { companyId },
    ),
  restartRun: (companyId: string, connectorKey: string, runId: string) =>
    api.post<NormalizedExecutionRun>(
      `/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}/restart`,
      { companyId },
    ),
  promptRun: (companyId: string, connectorKey: string, runId: string, prompt: string) =>
    api.post<{ ok: boolean; message?: string }>(
      `/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}/prompt`,
      { companyId, prompt },
    ),
  listRunArtifacts: (companyId: string, connectorKey: string, runId: string) =>
    api.get<{ artifacts: NormalizedExecutionArtifact[] }>(
      `/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}/artifacts?companyId=${encodeURIComponent(companyId)}`,
    ),
  listRunEvents: (companyId: string, connectorKey: string, runId: string, afterSeq: number = 0) =>
    api.get<{ events: NormalizedExecutionRunEvent[] }>(
      `/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}/events?companyId=${encodeURIComponent(companyId)}&afterSeq=${afterSeq}`,
    ),
  streamRunEvents: (
    companyId: string,
    connectorKey: string,
    runId: string,
    onEvent: (event: NormalizedExecutionRunEvent) => void,
    onError?: (message: string) => void,
  ) => {
    const source = new EventSource(
      `/api/execution/runs/${encodeURIComponent(connectorKey)}/${encodeURIComponent(runId)}/events/stream?companyId=${encodeURIComponent(companyId)}`,
      { withCredentials: true },
    );
    source.addEventListener("execution.run.event", (raw) => {
      const messageEvent = raw as MessageEvent<string>;
      onEvent(JSON.parse(messageEvent.data) as NormalizedExecutionRunEvent);
    });
    source.addEventListener("execution.run.error", (raw) => {
      const messageEvent = raw as MessageEvent<string>;
      const payload = JSON.parse(messageEvent.data) as { error?: string };
      onError?.(payload.error ?? "Execution stream failed");
    });
    source.onerror = () => {
      onError?.("Execution stream disconnected");
    };
    return () => source.close();
  },
  listRoutines: (companyId: string, connectorKey?: string) =>
    api.get<{ routines: ExecutionRoutineSummary[] }>(
      `/execution/routines?companyId=${encodeURIComponent(companyId)}${connectorKey ? `&connectorKey=${encodeURIComponent(connectorKey)}` : ""}`,
    ),
  listRoutineRuns: (companyId: string, connectorKey: string, routineId: string) =>
    api.get<{ runs: ExecutionRoutineRunSummary[] }>(
      `/execution/routines/${encodeURIComponent(connectorKey)}/${encodeURIComponent(routineId)}/runs?companyId=${encodeURIComponent(companyId)}`,
    ),
  triggerRoutine: (companyId: string, connectorKey: string, routineId: string) =>
    api.post<{ ok: boolean; run?: NormalizedExecutionRun | null }>(
      `/execution/routines/${encodeURIComponent(connectorKey)}/${encodeURIComponent(routineId)}/trigger`,
      { companyId },
    ),
  toggleRoutine: (companyId: string, connectorKey: string, routineId: string, enabled: boolean) =>
    api.post<{ ok: boolean; enabled: boolean }>(
      `/execution/routines/${encodeURIComponent(connectorKey)}/${encodeURIComponent(routineId)}/toggle`,
      { companyId, enabled },
    ),
};