CREATE TABLE `economic_import_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`accounting_year` text NOT NULL,
	`resource_type` text NOT NULL,
	`external_id` text NOT NULL,
	`voucher_number` text,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`checksum` text NOT NULL,
	`archive_bucket` text NOT NULL,
	`archive_object_key` text NOT NULL,
	`archive_version_id` text NOT NULL,
	`retain_until` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `economic_import_files_run_idx` ON `economic_import_files` (`run_id`);--> statement-breakpoint
CREATE TABLE `economic_import_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`run_id` integer NOT NULL,
	`accounting_year` text NOT NULL,
	`resource_type` text NOT NULL,
	`external_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`checksum` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `economic_import_records_run_resource_idx` ON `economic_import_records` (`run_id`,`resource_type`);--> statement-breakpoint
CREATE TABLE `economic_import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`integration_id` integer NOT NULL,
	`accounting_year` text NOT NULL,
	`run_type` text DEFAULT 'preflight' NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`source_agreement_number` text,
	`source_company_name` text,
	`record_count` integer DEFAULT 0 NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`warning_count` integer DEFAULT 0 NOT NULL,
	`manifest_json` text DEFAULT '{}' NOT NULL,
	`error_message` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`approved_at` text,
	`approved_by` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `economic_import_runs_company_year_started_unique` ON `economic_import_runs` (`company_id`,`accounting_year`,`started_at`);--> statement-breakpoint
CREATE INDEX `economic_import_runs_company_year_idx` ON `economic_import_runs` (`company_id`,`accounting_year`);
