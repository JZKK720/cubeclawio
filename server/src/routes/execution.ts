import { Router, type Request } from "express";
import type { Db } from "@cubeclawhub/db";
import {
  executionConnectorConfigSchema,
  listExecutionRunEventsQuerySchema,
  testExecutionConnectorSchema,
} from "@cubeclawhub/shared";
import { badRequest, forbidden } from "../errors.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import {
  executionConnectorConfigService,
  executionEventService,
  logActivity,
  normalizedExecutionService,
} from "../services/index.js";
import { validate } from "../middleware/validate.js";

function requireBoardOrAgent(req: Request) {
  if (req.actor.type === "board") return;
  if (req.actor.type === "agent") return;
  throw forbidden("Board or agent authentication required");
}

function resolveCompanyId(req: Request, explicit?: unknown): string {
  if (req.actor.type === "agent") {
    return req.actor.companyId!;
  }

  const value = typeof explicit === "string" && explicit.trim().length > 0 ? explicit.trim() : null;
  if (value) return value;

  if (req.actor.type === "board" && req.actor.companyIds?.length === 1) {
    return req.actor.companyIds[0] as string;
  }

  throw badRequest("companyId is required for this execution request");
}

export function executionRoutes(_db: Db) {
  const router = Router();
  const svc = normalizedExecutionService(_db);
  const events = executionEventService(_db);
  const connectorConfigs = executionConnectorConfigService(_db);

  router.get("/execution/connectors", (req, res) => {
    requireBoardOrAgent(req);
    res.json({ connectors: svc.listConnectorDefinitions() });
  });

  router.get("/execution/companies/:companyId/connectors", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json({ connectors: await svc.listCompanyConnectors(companyId) });
  });

  router.put("/execution/companies/:companyId/connectors/:key", validate(executionConnectorConfigSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const connectorKey = req.params.key as string;
    assertCompanyAccess(req, companyId);

    const saved = await connectorConfigs.upsert(companyId, connectorKey, req.body as { enabled?: boolean; config?: Record<string, unknown> });

    await logActivity(_db, {
      companyId,
      ...getActorInfo(req),
      action: "execution.connector_config.updated",
      entityType: "execution_connector",
      entityId: connectorKey,
      details: { enabled: saved.enabled },
    });

    res.json(saved);
  });

  router.delete("/execution/companies/:companyId/connectors/:key", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const connectorKey = req.params.key as string;
    assertCompanyAccess(req, companyId);
    const removed = await connectorConfigs.remove(companyId, connectorKey);
    if (!removed) {
      res.status(404).json({ error: "Connector config not found" });
      return;
    }

    await logActivity(_db, {
      companyId,
      ...getActorInfo(req),
      action: "execution.connector_config.deleted",
      entityType: "execution_connector",
      entityId: connectorKey,
      details: {},
    });

    res.json({ ok: true });
  });

  router.post("/execution/companies/:companyId/connectors/:key/test", validate(testExecutionConnectorSchema), async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.testConnector({
      companyId,
      key: req.params.key as string,
      config: req.body?.config as Record<string, unknown> | undefined,
    });
    res.json(result);
  });

  router.post("/execution/connectors/:key/test", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const result = await svc.testConnector({
      companyId,
      key: req.params.key as string,
      config: (req.body?.config ?? req.body ?? {}) as Record<string, unknown>,
    });
    res.json(result);
  });

  router.get("/execution/runs", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const runs = await svc.listRuns({
      companyId,
      connectorKey: typeof req.query.connectorKey === "string" ? req.query.connectorKey : undefined,
    });
    res.json({ runs });
  });

  router.get("/execution/runs/:connectorKey/:runId", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const run = await svc.getRun({
      companyId,
      connectorKey: req.params.connectorKey as string,
      runId: req.params.runId as string,
    });
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    res.json(run);
  });

  router.post("/execution/runs/:connectorKey/:runId/cancel", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const result = await svc.cancelRun({
      companyId,
      connectorKey: req.params.connectorKey as string,
      runId: req.params.runId as string,
    });
    res.json(result);
  });

  router.post("/execution/runs/:connectorKey/:runId/restart", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const run = await svc.restartRun({
      companyId,
      connectorKey: req.params.connectorKey as string,
      runId: req.params.runId as string,
    });
    res.json(run);
  });

  router.post("/execution/runs/:connectorKey/:runId/prompt", async (req, res) => {
    requireBoardOrAgent(req);
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
      throw badRequest("prompt is required");
    }
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const result = await svc.promptRun({
      companyId,
      connectorKey: req.params.connectorKey as string,
      runId: req.params.runId as string,
      prompt,
    });
    res.json(result);
  });

  router.get("/execution/runs/:connectorKey/:runId/artifacts", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const artifacts = await svc.listRunArtifacts({
      companyId,
      connectorKey: req.params.connectorKey as string,
      runId: req.params.runId as string,
    });
    res.json({ artifacts });
  });

  router.get("/execution/runs/:connectorKey/:runId/events", async (req, res) => {
    requireBoardOrAgent(req);
    listExecutionRunEventsQuerySchema.parse(req.query);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const afterSeq = Number(req.query.afterSeq ?? 0);
    const limit = Number(req.query.limit ?? 200);
    const runEvents = await svc.listRunEvents({
      companyId,
      connectorKey: req.params.connectorKey as string,
      runId: req.params.runId as string,
      afterSeq: Number.isFinite(afterSeq) ? afterSeq : 0,
      limit: Number.isFinite(limit) ? limit : 200,
    });
    res.json({ events: runEvents });
  });

  router.get("/execution/runs/:connectorKey/:runId/events/stream", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);

    const connectorKey = req.params.connectorKey as string;
    const runId = req.params.runId as string;
    let afterSeq = Number(req.query.afterSeq ?? 0);
    if (!Number.isFinite(afterSeq) || afterSeq < 0) afterSeq = 0;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event: string, payload: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const initial = await svc.listRunEvents({ companyId, connectorKey, runId, afterSeq, limit: 200 });
    for (const event of initial) {
      afterSeq = Math.max(afterSeq, event.seq);
      send("execution.run.event", event);
    }

    const unsubscribe = events.subscribe(companyId, connectorKey, runId, (event) => {
      if (event.seq <= afterSeq) return;
      afterSeq = event.seq;
      send("execution.run.event", event);
    });

    const poller = setInterval(async () => {
      try {
        const synced = await svc.listRunEvents({ companyId, connectorKey, runId, afterSeq, limit: 200 });
        for (const event of synced) {
          if (event.seq <= afterSeq) continue;
          afterSeq = event.seq;
          send("execution.run.event", event);
        }
      } catch (error) {
        send("execution.run.error", {
          error: error instanceof Error ? error.message : "Failed to sync execution events",
        });
      }
    }, 3000);

    const keepAlive = setInterval(() => {
      res.write(`: keepalive ${Date.now()}\n\n`);
    }, 15000);

    req.on("close", () => {
      clearInterval(poller);
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  router.get("/execution/routines", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const routines = await svc.listRoutines({
      companyId,
      connectorKey: typeof req.query.connectorKey === "string" ? req.query.connectorKey : undefined,
    });
    res.json({ routines });
  });

  router.get("/execution/routines/:connectorKey/:routineId", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const routine = await svc.getRoutine({
      companyId,
      connectorKey: req.params.connectorKey as string,
      routineId: req.params.routineId as string,
    });
    if (!routine) {
      res.status(404).json({ error: "Routine not found" });
      return;
    }
    res.json(routine);
  });

  router.get("/execution/routines/:connectorKey/:routineId/runs", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.query.companyId);
    assertCompanyAccess(req, companyId);
    const runs = await svc.listRoutineRuns({
      companyId,
      connectorKey: req.params.connectorKey as string,
      routineId: req.params.routineId as string,
    });
    res.json({ runs });
  });

  router.post("/execution/routines/:connectorKey/:routineId/trigger", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const result = await svc.triggerRoutine({
      companyId,
      connectorKey: req.params.connectorKey as string,
      routineId: req.params.routineId as string,
    });
    res.json(result);
  });

  router.post("/execution/routines/:connectorKey/:routineId/toggle", async (req, res) => {
    requireBoardOrAgent(req);
    if (typeof req.body?.enabled !== "boolean") {
      throw badRequest("enabled boolean is required");
    }
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const result = await svc.setRoutineEnabled({
      companyId,
      connectorKey: req.params.connectorKey as string,
      routineId: req.params.routineId as string,
      enabled: req.body.enabled,
    });
    res.json(result);
  });

  router.delete("/execution/routines/:connectorKey/:routineId", async (req, res) => {
    requireBoardOrAgent(req);
    const companyId = resolveCompanyId(req, req.body?.companyId ?? req.query.companyId);
    assertCompanyAccess(req, companyId);
    const result = await svc.deleteRoutine({
      companyId,
      connectorKey: req.params.connectorKey as string,
      routineId: req.params.routineId as string,
    });
    res.json(result);
  });

  return router;
}