CREATE TABLE `sproom_child_companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`cvr` text NOT NULL,
	`external_company_id` text,
	`status` text DEFAULT 'afventer_sproom' NOT NULL,
	`source_products` text DEFAULT '[]' NOT NULL,
	`nemhandel_status` text DEFAULT 'afventer' NOT NULL,
	`peppol_status` text DEFAULT 'afventer' NOT NULL,
	`consent_at` text,
	`consent_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sproom_child_company_company_unique` ON `sproom_child_companies` (`company_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `sproom_child_company_cvr_unique` ON `sproom_child_companies` (`cvr`);
--> statement-breakpoint
CREATE UNIQUE INDEX `sproom_child_company_external_unique` ON `sproom_child_companies` (`external_company_id`);
