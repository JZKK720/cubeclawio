CREATE TABLE IF NOT EXISTS "execution_connector_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connector_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "execution_run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"connector_key" text NOT NULL,
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"level" text,
	"message" text,
	"payload" jsonb,
	"external_event_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_connector_configs" ADD CONSTRAINT "execution_connector_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "execution_run_events" ADD CONSTRAINT "execution_run_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_connector_configs_company_idx" ON "execution_connector_configs" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_connector_configs_connector_idx" ON "execution_connector_configs" USING btree ("connector_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "execution_connector_configs_company_connector_uq" ON "execution_connector_configs" USING btree ("company_id","connector_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_run_events_run_seq_idx" ON "execution_run_events" USING btree ("connector_key","run_id","seq");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_run_events_company_run_idx" ON "execution_run_events" USING btree ("company_id","connector_key","run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_run_events_company_created_idx" ON "execution_run_events" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "execution_run_events_company_run_seq_uq" ON "execution_run_events" USING btree ("company_id","connector_key","run_id","seq");