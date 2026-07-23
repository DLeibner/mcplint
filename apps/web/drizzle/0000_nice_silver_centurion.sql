CREATE TABLE "interest" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"run_id" varchar(16),
	"note" text
);
--> statement-breakpoint
CREATE TABLE "run_findings" (
	"run_id" varchar(16) NOT NULL,
	"rule_id" varchar(64) NOT NULL,
	"severity" varchar(8) NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "run_findings_run_id_rule_id_severity_pk" PRIMARY KEY("run_id","rule_id","severity")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ingest_method" varchar(8) NOT NULL,
	"server_name" text,
	"server_version" text,
	"tool_count" integer NOT NULL,
	"approx_tokens" integer NOT NULL,
	"composite" smallint NOT NULL,
	"surface" smallint NOT NULL,
	"naming" smallint NOT NULL,
	"descriptions" smallint NOT NULL,
	"schemas" smallint NOT NULL,
	"annotations" smallint NOT NULL,
	"design" smallint NOT NULL,
	"report" jsonb NOT NULL,
	"snapshot" jsonb,
	"visibility" varchar(12) DEFAULT 'unlisted' NOT NULL,
	"delete_token_hash" text NOT NULL,
	"ip_hash" text,
	"duration_ms" integer NOT NULL,
	"engine_version" text NOT NULL,
	"purge_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "run_findings" ADD CONSTRAINT "run_findings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_findings_rule_id_idx" ON "run_findings" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "runs_created_at_idx" ON "runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "runs_server_name_idx" ON "runs" USING btree ("server_name");--> statement-breakpoint
CREATE INDEX "runs_purge_at_idx" ON "runs" USING btree ("purge_at");