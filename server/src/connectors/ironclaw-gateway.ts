import type {
  ExecutionArtifactKind,
  ExecutionConnectorDefinition,
  ExecutionConnectorHealth,
  ExecutionRunEventQuery,
  ExecutionConnectorModule,
  ExecutionRoutineReference,
  ExecutionRoutineRunSummary,
  ExecutionRoutineSummary,
  ExternalExecutionRef,
  IronclawGatewayConnectorConfig,
  NormalizedExecutionArtifact,
  NormalizedExecutionRun,
  NormalizedExecutionRunEvent,
  NormalizedExecutionRunStatus,
} from "@cubeclawio/shared";

const DEFAULT_TIMEOUT_MS = 10_000;
const CONNECTOR_KEY = "ironclaw_gateway";
const PROVIDER = "ironclaw";

type IronclawJobInfo = {
  id: string;
  title: string;
  state: string;
  user_id: string;
  created_at: string;
  started_at?: string | null;
};

type IronclawJobListResponse = {
  jobs: IronclawJobInfo[];
};

type IronclawTransitionInfo = {
  from: string;
  to: string;
  timestamp: string;
  reason?: string | null;
};

type IronclawJobDetailResponse = {
  id: string;
  title: string;
  description: string;
  state: string;
  user_id: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  elapsed_secs?: number | null;
  project_dir?: string | null;
  browse_url?: string | null;
  job_mode?: string | null;
  transitions: IronclawTransitionInfo[];
  can_restart?: boolean;
  can_prompt?: boolean;
  job_kind?: string | null;
};

type IronclawProjectFileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
};

type IronclawProjectFilesResponse = {
  entries: IronclawProjectFileEntry[];
};

type IronclawRoutineInfo = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  trigger_raw: string;
  trigger_summary: string;
  action_type: string;
  last_run_at?: string | null;
  next_fire_at?: string | null;
  run_count: number;
  consecutive_failures: number;
  status: string;
};

type IronclawRoutineListResponse = {
  routines: IronclawRoutineInfo[];
};

type IronclawRoutineRunInfo = {
  id: string;
  trigger_type: string;
  started_at: string;
  completed_at?: string | null;
  status: string;
  result_summary?: string | null;
  tokens_used?: number | null;
  job_id?: string | null;
};

type IronclawRoutineDetailResponse = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  trigger_raw: string;
  trigger_summary: string;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  notify: Record<string, unknown>;
  last_run_at?: string | null;
  next_fire_at?: string | null;
  run_count: number;
  consecutive_failures: number;
  created_at: string;
  recent_runs: IronclawRoutineRunInfo[];
};

type IronclawActionResponse = {
  status?: string;
  job_id?: string;
  routine_id?: string;
  run_id?: string;
};

type IronclawJobEventInfo = {
  seq?: number;
  type?: string;
  event_type?: string;
  kind?: string;
  level?: string | null;
  message?: string | null;
  text?: string | null;
  stream?: string | null;
  status?: string | null;
  phase?: string | null;
  tool_name?: string | null;
  payload?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
  timestamp?: string | null;
  created_at?: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBaseUrl(rawBaseUrl: string): string {
  return rawBaseUrl.replace(/\/+$/, "");
}

function extractConnectorConfig(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (isObjectRecord(input?.connectorConfig)) {
    return input.connectorConfig;
  }
  return input ?? {};
}

function parseConfig(config: Record<string, unknown>): {
  baseUrl: string | null;
  authToken: string | null;
  timeoutMs: number;
} {
  const parsed = extractConnectorConfig(config) as unknown as IronclawGatewayConnectorConfig;
  const baseUrl = asNonEmptyString(parsed.baseUrl) ?? asNonEmptyString(process.env.IRONCLAW_GATEWAY_BASE_URL);
  const authToken = asNonEmptyString(parsed.authToken) ?? asNonEmptyString(process.env.IRONCLAW_GATEWAY_AUTH_TOKEN);
  const timeoutMs =
    typeof parsed.timeoutMs === "number" && Number.isFinite(parsed.timeoutMs) && parsed.timeoutMs > 0
      ? parsed.timeoutMs
      : typeof process.env.IRONCLAW_GATEWAY_TIMEOUT_MS === "string" && Number.isFinite(Number(process.env.IRONCLAW_GATEWAY_TIMEOUT_MS))
        ? Number(process.env.IRONCLAW_GATEWAY_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;

  return {
    baseUrl,
    authToken,
    timeoutMs,
  };
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCompanyIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
  const companyId = metadata?.companyId;
  return typeof companyId === "string" && companyId.trim().length > 0 ? companyId.trim() : "unknown-company";
}

function getProviderKey(definition: ExecutionConnectorDefinition): string {
  const rawProvider = definition.metadata?.provider;
  return typeof rawProvider === "string" && rawProvider.trim().length > 0
    ? rawProvider.trim()
    : definition.adapterType;
}

function buildExternalRef(
  definition: ExecutionConnectorDefinition,
  input: {
    companyId?: string | null;
    jobId?: string | null;
    routineId?: string | null;
    routineRunId?: string | null;
    ownerKey?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): ExternalExecutionRef {
  return {
    connectorKey: definition.key,
    provider: getProviderKey(definition),
    jobId: input.jobId ?? null,
    routineId: input.routineId ?? null,
    routineRunId: input.routineRunId ?? null,
    ownerKey: input.ownerKey ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.companyId ? { companyId: input.companyId } : {}),
    },
  };
}

function normalizeIronclawRunStatus(state: string): NormalizedExecutionRunStatus {
  switch (state) {
    case "creating":
    case "pending":
      return "queued";
    case "running":
    case "in_progress":
    case "active":
      return "running";
    case "completed":
      return "succeeded";
    case "cancelled":
    case "disabled":
      return "cancelled";
    case "timed_out":
      return "timed_out";
    case "awaiting_input":
      return "awaiting_input";
    case "awaiting_approval":
      return "awaiting_approval";
    case "interrupted":
    case "stuck":
    case "failed":
    case "failing":
    default:
      return "failed";
  }
}

function mapJobInfoToRun(
  definition: ExecutionConnectorDefinition,
  job: IronclawJobInfo,
  companyId: string,
): NormalizedExecutionRun {
  const startedAt = job.started_at ?? null;
  const status = normalizeIronclawRunStatus(job.state);
  return {
    id: `${definition.key}:job:${job.id}`,
    companyId,
    kind: "job",
    sourceKind: "manual",
    status,
    connectorKey: definition.key,
    adapterType: definition.adapterType,
    title: job.title,
    summary: null,
    external: buildExternalRef(definition, {
      companyId,
      jobId: job.id,
      ownerKey: job.user_id,
    }),
    usage: null,
    previewUrls: null,
    runtimeServices: null,
    startedAt,
    finishedAt: status === "succeeded" || status === "failed" || status === "cancelled" ? startedAt : null,
    createdAt: job.created_at,
    updatedAt: job.started_at ?? job.created_at,
  };
}

function mapJobDetailToRun(
  definition: ExecutionConnectorDefinition,
  job: IronclawJobDetailResponse,
  companyId: string,
): NormalizedExecutionRun {
  return {
    id: `${definition.key}:job:${job.id}`,
    companyId,
    kind: "job",
    sourceKind: "manual",
    status: normalizeIronclawRunStatus(job.state),
    connectorKey: definition.key,
    adapterType: definition.adapterType,
    title: job.title,
    summary: job.description || null,
    external: buildExternalRef(definition, {
      companyId,
      jobId: job.id,
      ownerKey: job.user_id,
      metadata: {
        elapsedSecs: job.elapsed_secs ?? null,
        jobMode: job.job_mode ?? null,
        jobKind: job.job_kind ?? null,
        transitions: job.transitions,
      },
    }),
    usage: null,
    previewUrls: job.browse_url ? [job.browse_url] : null,
    runtimeServices: null,
    startedAt: job.started_at ?? null,
    finishedAt: job.completed_at ?? null,
    createdAt: job.created_at,
    updatedAt: job.completed_at ?? job.started_at ?? job.created_at,
  };
}

function mapRoutineInfo(
  definition: ExecutionConnectorDefinition,
  routine: IronclawRoutineInfo,
): ExecutionRoutineSummary {
  return {
    connectorKey: definition.key,
    routineId: routine.id,
    name: routine.name,
    description: routine.description,
    enabled: routine.enabled,
    triggerType: routine.trigger_type,
    triggerSummary: routine.trigger_summary,
    lastRunAt: routine.last_run_at ?? null,
    nextFireAt: routine.next_fire_at ?? null,
    metadata: {
      triggerRaw: routine.trigger_raw,
      actionType: routine.action_type,
      runCount: routine.run_count,
      consecutiveFailures: routine.consecutive_failures,
      status: routine.status,
    },
  };
}

function mapRoutineRun(
  definition: ExecutionConnectorDefinition,
  routineId: string,
  run: IronclawRoutineRunInfo,
  companyId: string,
): ExecutionRoutineRunSummary {
  return {
    id: run.id,
    routineId,
    status: normalizeIronclawRunStatus(run.status),
    triggerType: run.trigger_type,
    startedAt: run.started_at,
    finishedAt: run.completed_at ?? null,
    external: buildExternalRef(definition, {
      companyId,
      jobId: run.job_id ?? null,
      routineId,
      routineRunId: run.id,
      metadata: {
        tokensUsed: run.tokens_used ?? null,
      },
    }),
    summary: run.result_summary ?? null,
  };
}

function buildHeaders(authToken: string | null, extras?: HeadersInit): Headers {
  const headers = new Headers(extras);
  headers.set("Accept", "application/json");
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  return headers;
}

function ensureBodyRecord(body: unknown, code: string): Record<string, unknown> {
  if (!isObjectRecord(body)) {
    throw new Error(code);
  }
  return body;
}

async function requestIronclaw(
  config: Record<string, unknown>,
  input: {
    path: string;
    method?: "GET" | "POST" | "DELETE";
    body?: Record<string, unknown> | null;
    headers?: HeadersInit;
  },
): Promise<{ parsed: ReturnType<typeof parseConfig>; status: number; body: unknown }> {
  const parsed = parseConfig(config);
  if (!parsed.baseUrl) throw new Error("ironclaw_gateway_base_url_missing");

  const normalizedBaseUrl = new URL(normalizeBaseUrl(parsed.baseUrl));
  const response = await fetchJson(
    new URL(input.path, normalizedBaseUrl).toString(),
    {
      method: input.method ?? "GET",
      headers: buildHeaders(parsed.authToken, {
        ...(input.body ? { "Content-Type": "application/json" } : {}),
        ...(input.headers ?? {}),
      }),
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    },
    parsed.timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`ironclaw_gateway_http_${response.status}`);
  }

  return {
    parsed,
    status: response.status,
    body: response.body,
  };
}

function normalizeIronclawEventKind(event: IronclawJobEventInfo): NormalizedExecutionRunEvent["kind"] {
  const eventType = `${event.type ?? event.event_type ?? event.kind ?? ""}`.toLowerCase();
  if (eventType.includes("approval")) return "approval.required";
  if (eventType.includes("input") || eventType.includes("prompt")) return "input.required";
  if (eventType.includes("tool") && (eventType.includes("start") || eventType.includes("begin"))) return "tool.started";
  if (eventType.includes("tool") && (eventType.includes("finish") || eventType.includes("complete") || eventType.includes("end"))) return "tool.completed";
  if (eventType.includes("artifact") || isObjectRecord(event.payload?.artifact) || isObjectRecord(event.data?.artifact)) return "artifact.created";
  if (eventType.includes("status") || eventType.includes("state") || eventType.includes("transition")) return "status.changed";
  if (eventType.includes("error") || event.level === "error") return "error";
  if (eventType.includes("delta") || event.stream === "stdout" || event.stream === "stderr") return "output.delta";
  return "output.message";
}

function mapIronclawJobEvent(
  definition: ExecutionConnectorDefinition,
  runId: string,
  event: IronclawJobEventInfo,
  fallbackSeq: number,
): NormalizedExecutionRunEvent {
  const seq = typeof event.seq === "number" && Number.isFinite(event.seq) ? event.seq : fallbackSeq;
  const payload = {
    ...(isObjectRecord(event.payload) ? event.payload : {}),
    ...(isObjectRecord(event.data) ? event.data : {}),
    ...(event.stream ? { stream: event.stream } : {}),
    ...(event.status ? { status: event.status } : {}),
    ...(event.phase ? { phase: event.phase } : {}),
    ...(event.tool_name ? { toolName: event.tool_name } : {}),
  };

  return {
    id: `${definition.key}:${runId}:${seq}`,
    seq,
    runId: `${definition.key}:job:${runId}`,
    connectorKey: definition.key,
    kind: normalizeIronclawEventKind(event),
    level: event.level === "warn" || event.level === "error" ? event.level : "info",
    message: event.message ?? event.text ?? null,
    payload: Object.keys(payload).length > 0 ? payload : null,
    externalEventType: event.type ?? event.event_type ?? event.kind ?? null,
    createdAt: event.timestamp ?? event.created_at ?? new Date().toISOString(),
  };
}

export async function testIronclawGatewayConnector(
  config: Record<string, unknown>,
): Promise<ExecutionConnectorHealth> {
  const parsed = parseConfig(config);

  if (!parsed.baseUrl) {
    return {
      status: "unreachable",
      testedAt: new Date().toISOString(),
      message: "IronClaw connector requires a baseUrl.",
      detail: {
        code: "ironclaw_gateway_base_url_missing",
      },
    };
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(normalizeBaseUrl(parsed.baseUrl));
  } catch {
    return {
      status: "unreachable",
      testedAt: new Date().toISOString(),
      message: `Invalid IronClaw baseUrl: ${parsed.baseUrl}`,
      detail: {
        code: "ironclaw_gateway_base_url_invalid",
      },
    };
  }

  try {
    const healthResult = await fetchJson(
      new URL("/api/health", normalizedUrl).toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      parsed.timeoutMs,
    );

    if (!healthResult.ok) {
      return {
        status: "unreachable",
        testedAt: new Date().toISOString(),
        message: `IronClaw health endpoint returned ${healthResult.status}.`,
        detail: {
          code: "ironclaw_gateway_health_failed",
          health: healthResult.body,
        },
      };
    }

    if (!parsed.authToken) {
      return {
        status: "unauthorized",
        testedAt: new Date().toISOString(),
        message: "IronClaw health endpoint is reachable, but authToken is missing for protected gateway routes.",
        detail: {
          code: "ironclaw_gateway_auth_missing",
          health: healthResult.body,
        },
      };
    }

    const gatewayStatusResult = await fetchJson(
      new URL("/api/gateway/status", normalizedUrl).toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${parsed.authToken}`,
        },
      },
      parsed.timeoutMs,
    );

    if (gatewayStatusResult.status === 401 || gatewayStatusResult.status === 403) {
      return {
        status: "unauthorized",
        testedAt: new Date().toISOString(),
        message: "IronClaw gateway rejected the supplied authToken.",
        detail: {
          code: "ironclaw_gateway_auth_rejected",
          health: healthResult.body,
          gatewayStatus: gatewayStatusResult.body,
        },
      };
    }

    if (!gatewayStatusResult.ok) {
      return {
        status: "degraded",
        testedAt: new Date().toISOString(),
        message: `IronClaw health endpoint succeeded, but gateway status returned ${gatewayStatusResult.status}.`,
        detail: {
          code: "ironclaw_gateway_status_failed",
          health: healthResult.body,
          gatewayStatus: gatewayStatusResult.body,
        },
      };
    }

    return {
      status: "healthy",
      testedAt: new Date().toISOString(),
      message: "IronClaw gateway is reachable and authenticated.",
      detail: {
        health: healthResult.body,
        gatewayStatus: gatewayStatusResult.body,
      },
    };
  } catch (error) {
    return {
      status: "unreachable",
      testedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Failed to reach IronClaw gateway.",
      detail: {
        code: "ironclaw_gateway_request_failed",
      },
    };
  }
}

export const ironclawGatewayConnector: ExecutionConnectorModule = {
  definition: {
    key: "ironclaw_gateway",
    adapterType: "ironclaw_gateway",
    label: "IronClaw Gateway",
    transport: "hybrid",
    operations: ["job", "routine"],
    capabilities: {
      supportsJobs: true,
      supportsRoutines: true,
      supportsSessions: false,
      supportsJobRestart: true,
      supportsJobPrompt: true,
      supportsJobFiles: true,
      supportsRoutineToggle: true,
      supportsRoutineDelete: true,
      supportsStreamingEvents: true,
    },
    metadata: {
      provider: "ironclaw",
      routeFamily: "gateway-http",
    },
  },
  testConnector: testIronclawGatewayConnector,
  jobs: {
    async submitJob() {
      throw new Error("ironclaw_gateway_submit_not_implemented");
    },

    async getJob(runRef) {
      const companyId = getCompanyIdFromMetadata(runRef.metadata ?? null);
      const jobId = asNonEmptyString(runRef.jobId);
      if (!jobId) {
        throw new Error("ironclaw_gateway_job_id_missing");
      }

      const { body } = await requestIronclaw(runRef.metadata ?? {}, {
        path: `/api/jobs/${jobId}`,
      });

      return mapJobDetailToRun(
        ironclawGatewayConnector.definition,
        ensureBodyRecord(body, "ironclaw_gateway_job_detail_invalid") as unknown as IronclawJobDetailResponse,
        companyId,
      );
    },

    async listJobs(filter) {
      const companyId = getCompanyIdFromMetadata(isObjectRecord(filter) ? filter : null);
      const { body } = await requestIronclaw((isObjectRecord(filter) ? filter : {}) as Record<string, unknown>, {
        path: "/api/jobs",
      });
      const parsed = ensureBodyRecord(body, "ironclaw_gateway_jobs_invalid") as unknown as IronclawJobListResponse;
      return parsed.jobs.map((job) => mapJobInfoToRun(ironclawGatewayConnector.definition, job, companyId));
    },

    async listJobEvents(runRef, query) {
      const jobId = asNonEmptyString(runRef.jobId);
      if (!jobId) {
        throw new Error("ironclaw_gateway_job_id_missing");
      }

      const afterSeq = typeof query?.afterSeq === "number" && Number.isFinite(query.afterSeq) ? query.afterSeq : 0;
      const limit = typeof query?.limit === "number" && Number.isFinite(query.limit) ? query.limit : 200;
      const params = new URLSearchParams();
      params.set("after_seq", String(afterSeq));
      params.set("limit", String(limit));

      const { body } = await requestIronclaw(runRef.metadata ?? {}, {
        path: `/api/jobs/${jobId}/events?${params.toString()}`,
      });

      const rawEvents = Array.isArray(body)
        ? body
        : isObjectRecord(body) && Array.isArray(body.events)
          ? body.events
          : [];

      return rawEvents
        .filter((event): event is IronclawJobEventInfo => isObjectRecord(event))
        .map((event, index) => mapIronclawJobEvent(ironclawGatewayConnector.definition, jobId, event, afterSeq + index + 1))
        .filter((event) => event.seq > afterSeq)
        .slice(0, limit);
    },

    async cancelJob(runRef) {
      const jobId = asNonEmptyString(runRef.jobId);
      if (!jobId) {
        throw new Error("ironclaw_gateway_job_id_missing");
      }
      const { body } = await requestIronclaw(runRef.metadata ?? {}, {
        path: `/api/jobs/${jobId}/cancel`,
        method: "POST",
      });
      const parsed = (isObjectRecord(body) ? body : {}) as IronclawActionResponse;
      return {
        ok: true,
        message: typeof parsed.status === "string" ? parsed.status : "cancelled",
      };
    },

    async restartJob(runRef) {
      const jobId = asNonEmptyString(runRef.jobId);
      if (!jobId) {
        throw new Error("ironclaw_gateway_job_id_missing");
      }
      await requestIronclaw(runRef.metadata ?? {}, {
        path: `/api/jobs/${jobId}/restart`,
        method: "POST",
      });
      const restarted = await this.getJob(runRef);
      if (!restarted) throw new Error("ironclaw_gateway_job_not_found_after_restart");
      return restarted;
    },

    async sendJobPrompt(request) {
      const runRef = request as unknown as ExternalExecutionRef & { metadata?: Record<string, unknown> | null };
      const jobId = asNonEmptyString(runRef.jobId ?? request.runId);
      if (!jobId) {
        throw new Error("ironclaw_gateway_job_id_missing");
      }
      const { body } = await requestIronclaw(runRef.metadata ?? request.metadata ?? {}, {
        path: `/api/jobs/${jobId}/prompt`,
        method: "POST",
        body: {
          prompt: request.prompt,
        },
      });
      const parsed = (isObjectRecord(body) ? body : {}) as IronclawActionResponse;
      return {
        ok: true,
        message: typeof parsed.status === "string" ? parsed.status : "prompt_sent",
      };
    },

    async listJobArtifacts(runRef) {
      const companyId = getCompanyIdFromMetadata(runRef.metadata ?? null);
      const jobId = asNonEmptyString(runRef.jobId);
      if (!jobId) {
        throw new Error("ironclaw_gateway_job_id_missing");
      }

      const [detailResult, filesResult] = await Promise.all([
        requestIronclaw(runRef.metadata ?? {}, {
          path: `/api/jobs/${jobId}`,
        }),
        requestIronclaw(runRef.metadata ?? {}, {
          path: `/api/jobs/${jobId}/files/list`,
        }).catch(() => null),
      ]);

      const detail = ensureBodyRecord(detailResult.body, "ironclaw_gateway_job_detail_invalid") as unknown as IronclawJobDetailResponse;
      const artifacts: NormalizedExecutionArtifact[] = [];

      if (detail.browse_url) {
        artifacts.push({
          id: `${CONNECTOR_KEY}:artifact:${jobId}:preview`,
          runId: `${CONNECTOR_KEY}:job:${jobId}`,
          kind: "preview_url" satisfies ExecutionArtifactKind,
          label: "Project Preview",
          url: detail.browse_url,
          contentType: "text/html",
          metadata: { companyId },
          createdAt: detail.completed_at ?? detail.started_at ?? detail.created_at,
        });
      }

      if (filesResult) {
        const parsedFiles = ensureBodyRecord(filesResult.body, "ironclaw_gateway_job_files_invalid") as unknown as IronclawProjectFilesResponse;
        for (const entry of parsedFiles.entries) {
          artifacts.push({
            id: `${CONNECTOR_KEY}:artifact:${jobId}:${entry.path}`,
            runId: `${CONNECTOR_KEY}:job:${jobId}`,
            kind: entry.is_dir ? "file" : "file",
            label: entry.name,
            path: entry.path,
            externalRef: jobId,
            metadata: {
              companyId,
              isDir: entry.is_dir,
            },
            createdAt: detail.completed_at ?? detail.started_at ?? detail.created_at,
          });
        }
      }

      return artifacts;
    },
  },
  routines: {
    async listRoutines(filter) {
      const { body } = await requestIronclaw((isObjectRecord(filter) ? filter : {}) as Record<string, unknown>, {
        path: "/api/routines",
      });
      const parsed = ensureBodyRecord(body, "ironclaw_gateway_routines_invalid") as unknown as IronclawRoutineListResponse;
      return parsed.routines.map((routine) => mapRoutineInfo(ironclawGatewayConnector.definition, routine));
    },

    async getRoutine(ref) {
      const { body } = await requestIronclaw((ref as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}, {
        path: `/api/routines/${ref.routineId}`,
      });
      const parsed = ensureBodyRecord(body, "ironclaw_gateway_routine_detail_invalid") as unknown as IronclawRoutineDetailResponse;
      return {
        connectorKey: ironclawGatewayConnector.definition.key,
        routineId: parsed.id,
        name: parsed.name,
        description: parsed.description,
        enabled: parsed.enabled,
        triggerType: parsed.trigger_type,
        triggerSummary: parsed.trigger_summary,
        lastRunAt: parsed.last_run_at ?? null,
        nextFireAt: parsed.next_fire_at ?? null,
        metadata: {
          triggerRaw: parsed.trigger_raw,
          trigger: parsed.trigger,
          action: parsed.action,
          guardrails: parsed.guardrails,
          notify: parsed.notify,
          runCount: parsed.run_count,
          consecutiveFailures: parsed.consecutive_failures,
          createdAt: parsed.created_at,
        },
      };
    },

    async listRoutineRuns(ref) {
      const metadata = (ref as unknown as { metadata?: Record<string, unknown> }).metadata ?? null;
      const companyId = getCompanyIdFromMetadata(metadata);
      const { body } = await requestIronclaw(metadata ?? {}, {
        path: `/api/routines/${ref.routineId}`,
      });
      const parsed = ensureBodyRecord(body, "ironclaw_gateway_routine_detail_invalid") as unknown as IronclawRoutineDetailResponse;
      return parsed.recent_runs.map((run) => mapRoutineRun(ironclawGatewayConnector.definition, ref.routineId, run, companyId));
    },

    async triggerRoutine(ref) {
      const metadata = (ref as unknown as { metadata?: Record<string, unknown> }).metadata ?? null;
      const companyId = getCompanyIdFromMetadata(metadata);
      const { body } = await requestIronclaw(metadata ?? {}, {
        path: `/api/routines/${ref.routineId}/trigger`,
        method: "POST",
      });
      const parsed = (isObjectRecord(body) ? body : {}) as IronclawActionResponse;
      const runId = asNonEmptyString(parsed.run_id);
      return {
        ok: true,
        run: runId
          ? {
              id: `${CONNECTOR_KEY}:routine_run:${runId}`,
              companyId,
              kind: "routine_run",
              sourceKind: "routine",
              status: "queued",
              connectorKey: CONNECTOR_KEY,
              adapterType: ironclawGatewayConnector.definition.adapterType,
              title: `Routine ${ref.routineId}`,
              external: buildExternalRef(ironclawGatewayConnector.definition, {
                companyId,
                routineId: ref.routineId,
                routineRunId: runId,
              }),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : null,
      };
    },

    async setRoutineEnabled(ref, enabled) {
      await requestIronclaw((ref as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}, {
        path: `/api/routines/${ref.routineId}/toggle`,
        method: "POST",
        body: { enabled },
      });
      return {
        ok: true,
        enabled,
      };
    },

    async deleteRoutine(ref) {
      await requestIronclaw((ref as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}, {
        path: `/api/routines/${ref.routineId}`,
        method: "DELETE",
      });
      return {
        ok: true,
      };
    },
  },
};