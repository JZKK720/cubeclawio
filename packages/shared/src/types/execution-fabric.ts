export type ExecutionConnectorTransport = "http" | "sse" | "websocket" | "local_process" | "hybrid";

export type ExecutionConnectorOperationKind = "job" | "routine" | "session";

export type ExecutionConnectorHealthStatus = "unknown" | "healthy" | "degraded" | "unreachable" | "unauthorized";

export type NormalizedExecutionRunKind = "job" | "routine_run" | "session";

export type NormalizedExecutionSourceKind =
  | "manual"
  | "assignment"
  | "automation"
  | "api"
  | "approval"
  | "routine";

export type NormalizedExecutionRunStatus =
  | "queued"
  | "connecting"
  | "running"
  | "awaiting_input"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed_out";

export type NormalizedExecutionEventKind =
  | "status.changed"
  | "output.delta"
  | "output.message"
  | "tool.started"
  | "tool.completed"
  | "artifact.created"
  | "approval.required"
  | "input.required"
  | "control.requested"
  | "control.completed"
  | "error";

export type ExecutionArtifactKind = "log" | "transcript" | "preview_url" | "file" | "report" | "screenshot" | "json";

export interface ExecutionConnectorCapabilitySet {
  supportsJobs: boolean;
  supportsRoutines: boolean;
  supportsSessions: boolean;
  supportsJobRestart?: boolean;
  supportsJobPrompt?: boolean;
  supportsJobFiles?: boolean;
  supportsRoutineToggle?: boolean;
  supportsRoutineDelete?: boolean;
  supportsStreamingEvents?: boolean;
}

export interface ExecutionConnectorHealth {
  status: ExecutionConnectorHealthStatus;
  testedAt?: string;
  message?: string | null;
  detail?: Record<string, unknown> | null;
}

export interface ExecutionConnectorDefinition {
  key: string;
  adapterType: string;
  label: string;
  transport: ExecutionConnectorTransport;
  operations: ExecutionConnectorOperationKind[];
  capabilities: ExecutionConnectorCapabilitySet;
  health?: ExecutionConnectorHealth;
  metadata?: Record<string, unknown> | null;
}

export interface ExternalExecutionRef {
  connectorKey: string;
  provider: string;
  providerRunId?: string | null;
  jobId?: string | null;
  routineId?: string | null;
  routineRunId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  ownerKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NormalizedUsageSummary {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  costUsd?: number | null;
  biller?: string | null;
  provider?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface NormalizedExecutionArtifact {
  id: string;
  runId: string;
  kind: ExecutionArtifactKind;
  label: string;
  url?: string | null;
  path?: string | null;
  contentType?: string | null;
  externalRef?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NormalizedExecutionRunEvent {
  id: string;
  seq: number;
  runId: string;
  connectorKey: string;
  kind: NormalizedExecutionEventKind;
  level?: "info" | "warn" | "error" | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  externalEventType?: string | null;
  createdAt: string;
}

export interface ExecutionRunEventQuery {
  afterSeq?: number;
  limit?: number;
}

export interface NormalizedExecutionRun {
  id: string;
  companyId: string;
  kind: NormalizedExecutionRunKind;
  sourceKind: NormalizedExecutionSourceKind;
  status: NormalizedExecutionRunStatus;
  connectorKey: string;
  adapterType: string;
  title: string;
  summary?: string | null;
  issueId?: string | null;
  projectId?: string | null;
  approvalId?: string | null;
  agentId?: string | null;
  parentRunId?: string | null;
  rootRunId?: string | null;
  external: ExternalExecutionRef;
  usage?: NormalizedUsageSummary | null;
  previewUrls?: string[] | null;
  runtimeServices?: Array<Record<string, unknown>> | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionJobRequest {
  companyId: string;
  title: string;
  instructions: string;
  issueId?: string | null;
  projectId?: string | null;
  approvalId?: string | null;
  agentId?: string | null;
  parentRunId?: string | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionJobUpdateRequest {
  runId: string;
  prompt: string;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionRoutineReference {
  connectorKey: string;
  routineId: string;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionRoutineSummary {
  connectorKey: string;
  routineId: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  triggerType?: string | null;
  triggerSummary?: string | null;
  lastRunAt?: string | null;
  nextFireAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionRoutineRunSummary {
  id: string;
  routineId: string;
  status: NormalizedExecutionRunStatus;
  triggerType?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  external?: ExternalExecutionRef | null;
  summary?: string | null;
}

export interface ExecutionSessionOpenRequest {
  companyId: string;
  title: string;
  initialInput: string;
  issueId?: string | null;
  projectId?: string | null;
  parentRunId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionSessionSummary {
  connectorKey: string;
  sessionId: string;
  title?: string | null;
  status: NormalizedExecutionRunStatus;
  external?: ExternalExecutionRef | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExecutionJobConnector {
  submitJob(request: ExecutionJobRequest): Promise<NormalizedExecutionRun>;
  getJob(runRef: ExternalExecutionRef): Promise<NormalizedExecutionRun | null>;
  listJobs?(filter?: Record<string, unknown>): Promise<NormalizedExecutionRun[]>;
  cancelJob?(runRef: ExternalExecutionRef): Promise<{ ok: boolean; message?: string }>;
  restartJob?(runRef: ExternalExecutionRef): Promise<NormalizedExecutionRun>;
  sendJobPrompt?(request: ExecutionJobUpdateRequest): Promise<{ ok: boolean; message?: string }>;
  listJobArtifacts?(runRef: ExternalExecutionRef): Promise<NormalizedExecutionArtifact[]>;
  listJobEvents?(runRef: ExternalExecutionRef, query?: ExecutionRunEventQuery): Promise<NormalizedExecutionRunEvent[]>;
}

export interface CompanyExecutionConnectorConfig {
  id: string;
  companyId: string;
  connectorKey: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyExecutionConnector {
  definition: ExecutionConnectorDefinition;
  config: CompanyExecutionConnectorConfig | null;
  isConfigured: boolean;
}

export interface ExecutionRoutineConnector {
  listRoutines(filter?: Record<string, unknown>): Promise<ExecutionRoutineSummary[]>;
  getRoutine(ref: ExecutionRoutineReference): Promise<ExecutionRoutineSummary | null>;
  listRoutineRuns?(ref: ExecutionRoutineReference): Promise<ExecutionRoutineRunSummary[]>;
  triggerRoutine?(ref: ExecutionRoutineReference): Promise<{ ok: boolean; run?: NormalizedExecutionRun | null }>;
  setRoutineEnabled?(ref: ExecutionRoutineReference, enabled: boolean): Promise<{ ok: boolean; enabled: boolean }>;
  deleteRoutine?(ref: ExecutionRoutineReference): Promise<{ ok: boolean }>;
}

export interface ExecutionSessionConnector {
  openSession(request: ExecutionSessionOpenRequest): Promise<ExecutionSessionSummary>;
  getSession(ref: ExternalExecutionRef): Promise<ExecutionSessionSummary | null>;
  appendSessionInput?(ref: ExternalExecutionRef, input: string): Promise<{ ok: boolean; message?: string }>;
  closeSession?(ref: ExternalExecutionRef): Promise<{ ok: boolean }>;
}

export interface ExecutionConnectorModule {
  definition: ExecutionConnectorDefinition;
  testConnector?(config: Record<string, unknown>): Promise<ExecutionConnectorHealth>;
  jobs?: ExecutionJobConnector;
  routines?: ExecutionRoutineConnector;
  sessions?: ExecutionSessionConnector;
}

export interface IronclawGatewayConnectorConfig {
  baseUrl: string;
  authToken: string;
  timeoutMs?: number;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}