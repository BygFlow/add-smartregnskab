CREATE TABLE `ai_decision_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`recommendation` text NOT NULL,
	`reasoning` text NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`model` text,
	`confidence` real DEFAULT 0 NOT NULL,
	`risk_level` text DEFAULT 'lav' NOT NULL,
	`requires_approval` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'afventer_godkendelse' NOT NULL,
	`proposed_at` text NOT NULL,
	`decided_by` integer,
	`decided_at` text,
	`decision_note` text
);
--> statement-breakpoint
CREATE TABLE `ai_governance_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`target_autonomy_percent` integer DEFAULT 99 NOT NULL,
	`minimum_confidence` real DEFAULT 0.98 NOT NULL,
	`require_evidence` integer DEFAULT true NOT NULL,
	`approval_actions` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_governance_settings_company_unique` ON `ai_governance_settings` (`company_id`);--> statement-breakpoint
CREATE TABLE `regulatory_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`detected_at` text NOT NULL,
	`previous_hash` text,
	`new_hash` text NOT NULL,
	`status` text DEFAULT 'afventer_faglig_godkendelse' NOT NULL,
	`summary` text,
	`reviewed_by` integer,
	`reviewed_at` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `regulatory_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_key` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_checked_at` text,
	`last_http_status` integer,
	`etag` text,
	`last_modified` text,
	`content_hash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `regulatory_sources_source_key_unique` ON `regulatory_sources` (`source_key`);--> statement-breakpoint
ALTER TABLE `dimension_values` ADD `company_id` integer;--> statement-breakpoint
ALTER TABLE `file_versions` ADD `company_id` integer;--> statement-breakpoint
ALTER TABLE `integration_retry_queue` ADD `company_id` integer;--> statement-breakpoint
ALTER TABLE `integration_runs` ADD `company_id` integer;--> statement-breakpoint
ALTER TABLE `platform_sync_jobs` ADD `company_id` integer;--> statement-breakpoint
ALTER TABLE `platform_sync_mappings` ADD `company_id` integer;--> statement-breakpoint
ALTER TABLE `workflow_runs` ADD `company_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_company_number_unique` ON `invoices` (`company_id`,`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_company_number_unique` ON `journal_entries` (`company_id`,`entry_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_company_number_unique` ON `quotes` (`company_id`,`quote_number`);