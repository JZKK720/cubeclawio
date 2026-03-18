import { pgTable, uuid, text, timestamp, integer, jsonb, index, bigserial, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const executionRunEvents = pgTable(
  "execution_run_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    connectorKey: text("connector_key").notNull(),
    runId: text("run_id").notNull(),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(),
    level: text("level"),
    message: text("message"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    externalEventType: text("external_event_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runSeqIdx: index("execution_run_events_run_seq_idx").on(table.connectorKey, table.runId, table.seq),
    companyRunIdx: index("execution_run_events_company_run_idx").on(table.companyId, table.connectorKey, table.runId),
    companyCreatedIdx: index("execution_run_events_company_created_idx").on(table.companyId, table.createdAt),
    companyRunSeqUq: uniqueIndex("execution_run_events_company_run_seq_uq").on(
      table.companyId,
      table.connectorKey,
      table.runId,
      table.seq,
    ),
  }),
);