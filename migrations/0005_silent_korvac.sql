CREATE TABLE `professional_approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`requested_by` integer NOT NULL,
	`assigned_to` integer,
	`approval_type` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_note` text,
	`due_date` text,
	`decided_by` integer,
	`decided_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `professional_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`professional_role` text NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`requires_two_factor` integer DEFAULT 1 NOT NULL,
	`access_expires_at` text,
	`created_by` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `professional_membership_user_company_unique` ON `professional_memberships` (`user_id`,`company_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `active_company_id` integer;