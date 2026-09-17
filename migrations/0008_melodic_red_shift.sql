ALTER TABLE `plans` ADD `max_documents` integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `max_entries` integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `max_companies` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `plans` ADD `max_integrations` integer DEFAULT 2 NOT NULL;