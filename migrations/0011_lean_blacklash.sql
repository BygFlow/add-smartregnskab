ALTER TABLE `companies` ADD `document_inbox_token` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `document_auto_post` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `storage` text;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `storage_key` text;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `size_bytes` integer;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `sender_email` text;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `external_message_id` text;--> statement-breakpoint
ALTER TABLE `document_inbox` ADD `posted_journal_entry_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `companies_document_inbox_token_unique` ON `companies` (`document_inbox_token`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `document_inbox_company_message_unique` ON `document_inbox` (`company_id`, `external_message_id`);
