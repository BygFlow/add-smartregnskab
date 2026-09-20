CREATE TABLE `ai_usage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`subscription_owner_id` integer NOT NULL,
	`user_id` integer,
	`action_type` text NOT NULL,
	`model` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`credits` integer DEFAULT 1 NOT NULL,
	`estimated_cost_dkk` real DEFAULT 0 NOT NULL,
	`external_request_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_owner_id` integer NOT NULL,
	`auto_topup_enabled` integer DEFAULT 0 NOT NULL,
	`auto_topup_pack_credits` integer DEFAULT 500 NOT NULL,
	`hard_cost_cap_override` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_settings_subscription_owner_id_unique` ON `ai_usage_settings` (`subscription_owner_id`);--> statement-breakpoint
ALTER TABLE `plans` ADD `included_companies` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `additional_company_price` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `included_ai_credits` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `ai_addon_price` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `ai_addon_credits` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `ai_credits_per_additional_company` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `ai_cost_cap` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `ai_cost_cap_per_additional_company` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `ai_addon_enabled` integer DEFAULT 0 NOT NULL;