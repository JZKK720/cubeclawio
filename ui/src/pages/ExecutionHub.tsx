import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyExecutionConnector, NormalizedExecutionRunEvent } from "@cubeclawhub/shared";
import { ActivitySquare, Cable, Play, RefreshCcw, Radio, Save, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executionApi } from "../api/execution";
import { secretsApi } from "../api/secrets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function toneForStatus(status: string) {
  if (["running", "queued", "connecting", "awaiting_input", "awaiting_approval"].includes(status)) {
    return "text-amber-700 bg-amber-500/10 border-amber-500/20";
  }
  if (["failed", "cancelled", "timed_out"].includes(status)) {
    return "text-rose-700 bg-rose-500/10 border-rose-500/20";
  }
  return "text-emerald-700 bg-emerald-500/10 border-emerald-500/20";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function buildConnectorConfigPayload(input: {
  baseUrl: string;
  timeoutMs: string;
  userId: string;
  secretId: string;
  enabled: boolean;
}) {
  return {
    enabled: input.enabled,
    config: {
      ...(input.baseUrl.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
      ...(input.secretId ? { authToken: { type: "secret_ref", secretId: input.secretId, version: "latest" } } : {}),
      ...(input.timeoutMs.trim() ? { timeoutMs: Number(input.timeoutMs) } : {}),
      ...(input.userId.trim() ? { userId: input.userId.trim() } : {}),
    },
  };
}

function readSecretId(connector: CompanyExecutionConnector | null) {
  const authToken = connector?.config?.config?.authToken as { secretId?: string } | undefined;
  return typeof authToken?.secretId === "string" ? authToken.secretId : "";
}

export function ExecutionHub() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [selectedConnectorKey, setSelectedConnectorKey] = useState("ironclaw_gateway");
  const [selectedRunKey, setSelectedRunKey] = useState<string | null>(null);
  const [selectedRoutineKey, setSelectedRoutineKey] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("");
  const [userId, setUserId] = useState("");
  const [secretId, setSecretId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [streamEvents, setStreamEvents] = useState<NormalizedExecutionRunEvent[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Execution" },
    ]);
  }, [selectedCompany?.name, setBreadcrumbs]);

  const connectorsQuery = useQuery({
    queryKey: queryKeys.execution.connectors(selectedCompanyId ?? ""),
    queryFn: () => executionApi.listConnectors(selectedCompanyId!).then((result) => result.connectors),
    enabled: Boolean(selectedCompanyId),
  });

  const secretsQuery = useQuery({
    queryKey: queryKeys.secrets.list(selectedCompanyId ?? ""),
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const runsQuery = useQuery({
    queryKey: queryKeys.execution.runs(selectedCompanyId ?? "", selectedConnectorKey),
    queryFn: () => executionApi.listRuns(selectedCompanyId!, selectedConnectorKey).then((result) => result.runs),
    enabled: Boolean(selectedCompanyId),
    refetchInterval: 10_000,
  });

  const routinesQuery = useQuery({
    queryKey: queryKeys.execution.routines(selectedCompanyId ?? "", selectedConnectorKey),
    queryFn: () => executionApi.listRoutines(selectedCompanyId!, selectedConnectorKey).then((result) => result.routines),
    enabled: Boolean(selectedCompanyId),
    refetchInterval: 15_000,
  });

  const selectedConnector = useMemo(
    () => connectorsQuery.data?.find((connector) => connector.definition.key === selectedConnectorKey) ?? null,
    [connectorsQuery.data, selectedConnectorKey],
  );

  const selectedRun = useMemo(() => {
    if (!selectedRunKey) return null;
    return runsQuery.data?.find((run) => `${run.connectorKey}:${run.external.jobId ?? run.id}` === selectedRunKey) ?? null;
  }, [runsQuery.data, selectedRunKey]);

  const selectedRoutine = useMemo(() => {
    if (!selectedRoutineKey) return null;
    return routinesQuery.data?.find((routine) => `${routine.connectorKey}:${routine.routineId}` === selectedRoutineKey) ?? null;
  }, [routinesQuery.data, selectedRoutineKey]);

  const routineRunsQuery = useQuery({
    queryKey: queryKeys.execution.routineRuns(
      selectedCompanyId ?? "",
      selectedRoutine?.connectorKey ?? "",
      selectedRoutine?.routineId ?? "",
    ),
    queryFn: () =>
      executionApi
        .listRoutineRuns(selectedCompanyId!, selectedRoutine!.connectorKey, selectedRoutine!.routineId)
        .then((result) => result.runs),
    enabled: Boolean(selectedCompanyId && selectedRoutine),
  });

  const runArtifactsQuery = useQuery({
    queryKey: queryKeys.execution.runArtifacts(
      selectedCompanyId ?? "",
      selectedRun?.connectorKey ?? "",
      selectedRun?.external.jobId ?? "",
    ),
    queryFn: () =>
      executionApi
        .listRunArtifacts(selectedCompanyId!, selectedRun!.connectorKey, selectedRun!.external.jobId ?? selectedRun!.id)
        .then((result) => result.artifacts),
    enabled: Boolean(selectedCompanyId && selectedRun),
  });

  useEffect(() => {
    if (!connectorsQuery.data?.length) return;
    if (connectorsQuery.data.some((connector) => connector.definition.key === selectedConnectorKey)) return;
    setSelectedConnectorKey(connectorsQuery.data[0]!.definition.key);
  }, [connectorsQuery.data, selectedConnectorKey]);

  useEffect(() => {
    if (!selectedConnector) return;
    const config = selectedConnector.config?.config ?? {};
    setBaseUrl(typeof config.baseUrl === "string" ? config.baseUrl : "");
    setTimeoutMs(typeof config.timeoutMs === "number" ? String(config.timeoutMs) : "");
    setUserId(typeof config.userId === "string" ? config.userId : "");
    setSecretId(readSecretId(selectedConnector));
    setEnabled(selectedConnector.config?.enabled ?? true);
  }, [selectedConnector]);

  useEffect(() => {
    if (!runsQuery.data?.length) {
      setSelectedRunKey(null);
      return;
    }
    if (selectedRunKey && runsQuery.data.some((run) => `${run.connectorKey}:${run.external.jobId ?? run.id}` === selectedRunKey)) {
      return;
    }
    const first = runsQuery.data[0]!;
    setSelectedRunKey(`${first.connectorKey}:${first.external.jobId ?? first.id}`);
  }, [runsQuery.data, selectedRunKey]);

  useEffect(() => {
    if (!routinesQuery.data?.length) {
      setSelectedRoutineKey(null);
      return;
    }
    if (
      selectedRoutineKey &&
      routinesQuery.data.some((routine) => `${routine.connectorKey}:${routine.routineId}` === selectedRoutineKey)
    ) {
      return;
    }
    const first = routinesQuery.data[0]!;
    setSelectedRoutineKey(`${first.connectorKey}:${first.routineId}`);
  }, [routinesQuery.data, selectedRoutineKey]);

  useEffect(() => {
    if (!selectedCompanyId || !selectedRun?.external.jobId) {
      setStreamEvents([]);
      setStreamError(null);
      return;
    }

    let mounted = true;
    void executionApi
      .listRunEvents(selectedCompanyId, selectedRun.connectorKey, selectedRun.external.jobId)
      .then((result) => {
        if (!mounted) return;
        setStreamEvents(result.events);
      })
      .catch((error) => {
        if (!mounted) return;
        setStreamError(error instanceof Error ? error.message : "Failed to load execution events");
      });

    const stop = executionApi.streamRunEvents(
      selectedCompanyId,
      selectedRun.connectorKey,
      selectedRun.external.jobId,
      (event) => {
        if (!mounted) return;
        setStreamEvents((current) => {
          if (current.some((item) => item.seq === event.seq && item.connectorKey === event.connectorKey)) {
            return current;
          }
          return [...current, event].sort((left, right) => left.seq - right.seq).slice(-200);
        });
        setStreamError(null);
      },
      (message) => {
        if (!mounted) return;
        setStreamError(message);
      },
    );

    return () => {
      mounted = false;
      stop();
    };
  }, [selectedCompanyId, selectedRun?.connectorKey, selectedRun?.external.jobId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      executionApi.saveConnector(
        selectedCompanyId!,
        selectedConnectorKey,
        buildConnectorConfigPayload({ baseUrl, timeoutMs, userId, secretId, enabled }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.connectors(selectedCompanyId!) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.runs(selectedCompanyId!, selectedConnectorKey) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.routines(selectedCompanyId!, selectedConnectorKey) });
    },
  });

  const testMutation = useMutation({
    mutationFn: () =>
      executionApi.testConnector(
        selectedCompanyId!,
        selectedConnectorKey,
        buildConnectorConfigPayload({ baseUrl, timeoutMs, userId, secretId, enabled }).config,
      ),
  });

  const removeMutation = useMutation({
    mutationFn: () => executionApi.removeConnector(selectedCompanyId!, selectedConnectorKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.connectors(selectedCompanyId!) });
      setBaseUrl("");
      setTimeoutMs("");
      setUserId("");
      setSecretId("");
      setEnabled(true);
    },
  });

  const cancelRunMutation = useMutation({
    mutationFn: () => executionApi.cancelRun(selectedCompanyId!, selectedRun!.connectorKey, selectedRun!.external.jobId ?? selectedRun!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.runs(selectedCompanyId!, selectedConnectorKey) });
    },
  });

  const restartRunMutation = useMutation({
    mutationFn: () => executionApi.restartRun(selectedCompanyId!, selectedRun!.connectorKey, selectedRun!.external.jobId ?? selectedRun!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.runs(selectedCompanyId!, selectedConnectorKey) });
    },
  });

  const triggerRoutineMutation = useMutation({
    mutationFn: () => executionApi.triggerRoutine(selectedCompanyId!, selectedRoutine!.connectorKey, selectedRoutine!.routineId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.routines(selectedCompanyId!, selectedConnectorKey) });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.execution.routineRuns(selectedCompanyId!, selectedRoutine!.connectorKey, selectedRoutine!.routineId),
      });
    },
  });

  const toggleRoutineMutation = useMutation({
    mutationFn: () =>
      executionApi.toggleRoutine(
        selectedCompanyId!,
        selectedRoutine!.connectorKey,
        selectedRoutine!.routineId,
        !selectedRoutine!.enabled,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.execution.routines(selectedCompanyId!, selectedConnectorKey) });
    },
  });

  if (!selectedCompanyId) {
    return <div className="text-sm text-muted-foreground">Select a company to manage execution connectors.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_30%)] p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <Cable className="h-3.5 w-3.5" />
              IronHub Execution Fabric
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Connectors, runs, and routines</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Configure per-company execution connectors, inspect normalized runs, and follow live IronClaw job events without relying on process-level environment variables.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Company</div>
            <div className="mt-1 font-medium">{selectedCompany?.name ?? selectedCompanyId}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel title="Connectors" subtitle="Per-company runtime wiring and credential references.">
            <div className="space-y-2">
              {connectorsQuery.data?.map((connector) => {
                const selected = connector.definition.key === selectedConnectorKey;
                return (
                  <button
                    key={connector.definition.key}
                    type="button"
                    onClick={() => setSelectedConnectorKey(connector.definition.key)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${selected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30 hover:bg-muted/30"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{connector.definition.label}</div>
                        <div className="text-xs text-muted-foreground">{connector.definition.transport} · {connector.definition.adapterType}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${connector.isConfigured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}`}>
                        {connector.isConfigured ? "Configured" : "Needs setup"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Connector Config" subtitle="IronClaw auth is stored via company secret reference, not plaintext.">
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Base URL</span>
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://ironclaw:3000"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none"
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Auth token secret</span>
                <select
                  value={secretId}
                  onChange={(event) => setSecretId(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none"
                >
                  <option value="">Select a company secret</option>
                  {secretsQuery.data?.map((secret) => (
                    <option key={secret.id} value={secret.id}>
                      {secret.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Timeout (ms)</span>
                  <input
                    value={timeoutMs}
                    onChange={(event) => setTimeoutMs(event.target.value)}
                    placeholder="10000"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">User override</span>
                  <input
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="optional"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                Connector enabled for this company
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : "Save config"}
                </Button>
                <Button type="button" variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  <Radio className="mr-2 h-4 w-4" />
                  {testMutation.isPending ? "Testing..." : "Test connector"}
                </Button>
                <Button type="button" variant="outline" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear saved config
                </Button>
              </div>
              {testMutation.data ? (
                <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <div className="font-medium capitalize">{testMutation.data.status}</div>
                  <div className="text-muted-foreground">{testMutation.data.message ?? "No message"}</div>
                </div>
              ) : null}
              {saveMutation.error ? <div className="text-sm text-destructive">{saveMutation.error.message}</div> : null}
              {removeMutation.error ? <div className="text-sm text-destructive">{removeMutation.error.message}</div> : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Runs" subtitle="Normalized active and recent execution runs from the selected connector.">
            <div className="space-y-2">
              {runsQuery.data?.length ? (
                runsQuery.data.map((run) => {
                  const key = `${run.connectorKey}:${run.external.jobId ?? run.id}`;
                  const selected = key === selectedRunKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedRunKey(key)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${selected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30 hover:bg-muted/30"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-medium">{run.title}</div>
                          <div className="text-xs text-muted-foreground">{run.external.jobId ?? run.id}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneForStatus(run.status)}`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Started {formatDate(run.startedAt ?? run.createdAt)}</div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                  No runs available for {selectedConnectorKey}.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Live Run Stream" subtitle="Persisted normalized events with live SSE updates.">
            {selectedRun ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => cancelRunMutation.mutate()} disabled={cancelRunMutation.isPending}>
                    <ActivitySquare className="mr-2 h-4 w-4" />
                    Cancel run
                  </Button>
                  <Button type="button" variant="outline" onClick={() => restartRunMutation.mutate()} disabled={restartRunMutation.isPending}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Restart run
                  </Button>
                </div>
                {streamError ? <div className="text-sm text-destructive">{streamError}</div> : null}
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{selectedRun.title}</span>
                    <span>{streamEvents.length} events</span>
                  </div>
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {streamEvents.length ? (
                      streamEvents.map((event) => (
                        <div key={`${event.connectorKey}:${event.runId}:${event.seq}`} className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2">
                          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>#{event.seq} · {event.kind}</span>
                            <span>{formatDate(event.createdAt)}</span>
                          </div>
                          <div className="mt-1 text-sm">{event.message ?? "No message"}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No events have been recorded for this run yet.</div>
                    )}
                  </div>
                </div>
                {runArtifactsQuery.data?.length ? (
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Artifacts</div>
                    <div className="space-y-2 text-sm">
                      {runArtifactsQuery.data.map((artifact) => (
                        <div key={artifact.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 px-3 py-2">
                          <div>
                            <div className="font-medium">{artifact.label}</div>
                            <div className="text-xs text-muted-foreground">{artifact.kind}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{artifact.path ?? artifact.url ?? "stored"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                Select a run to inspect persisted events and artifacts.
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Routines" subtitle="Scheduled and manual routine controls for the selected connector.">
            <div className="space-y-2">
              {routinesQuery.data?.length ? (
                routinesQuery.data.map((routine) => {
                  const key = `${routine.connectorKey}:${routine.routineId}`;
                  const selected = key === selectedRoutineKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedRoutineKey(key)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${selected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30 hover:bg-muted/30"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{routine.name}</div>
                          <div className="text-xs text-muted-foreground">{routine.triggerSummary ?? routine.triggerType ?? "manual"}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${routine.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-zinc-500/20 bg-zinc-500/10 text-zinc-700"}`}>
                          {routine.enabled ? "Enabled" : "Paused"}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                  No routines available for {selectedConnectorKey}.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Routine Detail" subtitle="Trigger and inspect recent routine runs.">
            {selectedRoutine ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{selectedRoutine.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedRoutine.description ?? "No routine description"}</div>
                    </div>
                    <Workflow className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <div>Last run: {formatDate(selectedRoutine.lastRunAt)}</div>
                    <div>Next fire: {formatDate(selectedRoutine.nextFireAt)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => triggerRoutineMutation.mutate()} disabled={triggerRoutineMutation.isPending}>
                    <Play className="mr-2 h-4 w-4" />
                    Trigger routine
                  </Button>
                  <Button type="button" variant="outline" onClick={() => toggleRoutineMutation.mutate()} disabled={toggleRoutineMutation.isPending}>
                    {selectedRoutine.enabled ? "Disable routine" : "Enable routine"}
                  </Button>
                </div>
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent routine runs</div>
                  <div className="space-y-2">
                    {routineRunsQuery.data?.length ? (
                      routineRunsQuery.data.map((run) => (
                        <div key={run.id} className="rounded-xl border border-border/80 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{run.id}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneForStatus(run.status)}`}>{run.status}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatDate(run.startedAt)}{run.finishedAt ? ` → ${formatDate(run.finishedAt)}` : ""}</div>
                          {run.summary ? <div className="mt-2 text-sm">{run.summary}</div> : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground">No recent routine runs found.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                Select a routine to inspect its latest runs.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}