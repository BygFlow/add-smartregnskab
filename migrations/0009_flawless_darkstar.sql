CREATE TABLE `company_access_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`role` text DEFAULT 'leder' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_access_user_company_unique` ON `company_access_memberships` (`user_id`,`company_id`);--> statement-breakpoint
CREATE TABLE `company_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`se_number` text,
	`unit_type` text DEFAULT 'department' NOT NULL,
	`dimension_value_id` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_units_company_se_unique` ON `company_units` (`company_id`,`se_number`);--> statement-breakpoint
ALTER TABLE `companies` ADD `parent_company_id` integer;--> statement-breakpoint
ALTER TABLE `companies` ADD `subscription_owner_id` integer;--> statement-breakpoint
ALTER TABLE `companies` ADD `group_role` text DEFAULT 'standalone' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `ownership_percent` real;