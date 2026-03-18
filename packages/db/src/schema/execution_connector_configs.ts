import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const executionConnectorConfigs = pgTable(
  "execution_connector_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    connectorKey: text("connector_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("execution_connector_configs_company_idx").on(table.companyId),
    connectorIdx: index("execution_connector_configs_connector_idx").on(table.connectorKey),
    companyConnectorUq: uniqueIndex("execution_connector_configs_company_connector_uq").on(
      table.companyId,
      table.connectorKey,
    ),
  }),
);