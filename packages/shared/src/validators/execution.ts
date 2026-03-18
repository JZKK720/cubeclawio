import { z } from "zod";
import { envBindingSecretRefSchema } from "./secret.js";

export const executionConnectorConfigSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).default({}),
});

export type ExecutionConnectorConfigInput = z.infer<typeof executionConnectorConfigSchema>;

export const testExecutionConnectorSchema = z.object({
  config: z.record(z.unknown()).optional(),
});

export type TestExecutionConnector = z.infer<typeof testExecutionConnectorSchema>;

export const listExecutionRunEventsQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  companyId: z.string().uuid().optional(),
});

export type ListExecutionRunEventsQuery = z.infer<typeof listExecutionRunEventsQuerySchema>;

export const ironclawGatewayPersistentConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  authToken: envBindingSecretRefSchema.optional(),
  timeoutMs: z.number().int().positive().max(120000).optional(),
  userId: z.string().min(1).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type IronclawGatewayPersistentConfig = z.infer<typeof ironclawGatewayPersistentConfigSchema>;