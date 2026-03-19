import { EventEmitter } from "node:events";
import { and, asc, eq, gt, max } from "drizzle-orm";
import type { Db } from "@cubeclawio/db";
import { executionRunEvents } from "@cubeclawio/db";
import type { NormalizedExecutionRunEvent } from "@cubeclawio/shared";
import { getExecutionConnector } from "../connectors/index.js";
import { badRequest, notFound } from "../errors.js";
import { executionConnectorConfigService } from "./execution-connector-configs.js";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

type ExecutionRunEventRow = typeof executionRunEvents.$inferSelect;

function channelKey(companyId: string, connectorKey: string, runId: string) {
  return `${companyId}:${connectorKey}:${runId}`;
}

function toRunEvent(row: ExecutionRunEventRow): NormalizedExecutionRunEvent {
  return {
    id: String(row.id),
    seq: row.seq,
    runId: row.runId,
    connectorKey: row.connectorKey,
    kind: row.kind as NormalizedExecutionRunEvent["kind"],
    level: (row.level as NormalizedExecutionRunEvent["level"]) ?? null,
    message: row.message ?? null,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    externalEventType: row.externalEventType ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function executionEventService(db: Db) {
  const connectorConfigs = executionConnectorConfigService(db);

  async function getMaxSeq(companyId: string, connectorKey: string, runId: string) {
    const rows = await db
      .select({ value: max(executionRunEvents.seq) })
      .from(executionRunEvents)
      .where(
        and(
          eq(executionRunEvents.companyId, companyId),
          eq(executionRunEvents.connectorKey, connectorKey),
          eq(executionRunEvents.runId, runId),
        ),
      );

    return rows[0]?.value ?? 0;
  }

  return {
    subscribe(companyId: string, connectorKey: string, runId: string, listener: (event: NormalizedExecutionRunEvent) => void) {
      const key = channelKey(companyId, connectorKey, runId);
      emitter.on(key, listener);
      return () => emitter.off(key, listener);
    },

    async list(companyId: string, connectorKey: string, runId: string, afterSeq = 0, limit = 200) {
      const rows = await db
        .select()
        .from(executionRunEvents)
        .where(
          and(
            eq(executionRunEvents.companyId, companyId),
            eq(executionRunEvents.connectorKey, connectorKey),
            eq(executionRunEvents.runId, runId),
            gt(executionRunEvents.seq, afterSeq),
          ),
        )
        .orderBy(asc(executionRunEvents.seq))
        .limit(Math.max(1, Math.min(limit, 1000)));

      return rows.map(toRunEvent);
    },

    async sync(companyId: string, connectorKey: string, runId: string, opts?: { limit?: number }) {
      const connector = getExecutionConnector(connectorKey);
      if (!connector) throw notFound(`Unknown execution connector: ${connectorKey}`);
      if (!connector.jobs?.listJobEvents) return [];

      const runtimeConfig = await connectorConfigs.resolveRuntimeConfig(companyId, connectorKey, { allowMissing: false });
      const afterSeq = await getMaxSeq(companyId, connectorKey, runId);
      const events = await connector.jobs.listJobEvents(
        {
          connectorKey,
          provider: connectorKey,
          jobId: runId,
          metadata: {
            companyId,
            connectorConfig: runtimeConfig,
          },
        },
        { afterSeq, limit: opts?.limit },
      );

      const persisted: NormalizedExecutionRunEvent[] = [];
      for (const event of events) {
        await db
          .insert(executionRunEvents)
          .values({
            companyId,
            connectorKey,
            runId,
            seq: event.seq,
            kind: event.kind,
            level: event.level ?? null,
            message: event.message ?? null,
            payload: event.payload ?? null,
            externalEventType: event.externalEventType ?? null,
            createdAt: new Date(event.createdAt),
          })
          .onConflictDoNothing();

        const persistedEvent: NormalizedExecutionRunEvent = {
          ...event,
          runId,
          connectorKey,
        };
        persisted.push(persistedEvent);
        emitter.emit(channelKey(companyId, connectorKey, runId), persistedEvent);
      }

      return persisted;
    },

    async listAfterSync(companyId: string, connectorKey: string, runId: string, afterSeq = 0, limit = 200) {
      await this.sync(companyId, connectorKey, runId, { limit });
      return this.list(companyId, connectorKey, runId, afterSeq, limit);
    },
  };
}