CREATE TABLE `add_connect_invoice_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`invoice_id` integer NOT NULL,
	`source_product` text NOT NULL,
	`source_id` text NOT NULL,
	`storage` text NOT NULL,
	`storage_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`delivery_channel` text NOT NULL,
	`delivery_reference` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `add_connect_invoice_docs_company_source_unique` ON `add_connect_invoice_documents` (`company_id`,`source_product`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `add_connect_invoice_docs_invoice_unique` ON `add_connect_invoice_documents` (`invoice_id`);