CREATE TABLE `edi_gateway_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`source_id` text NOT NULL,
	`direction` text NOT NULL,
	`format` text NOT NULL,
	`document_type` text NOT NULL,
	`invoice_number` text,
	`recipient` text,
	`payload_xml` text NOT NULL,
	`sha256` text NOT NULL,
	`provider_message_id` text,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edi_gateway_document_source_unique` ON `edi_gateway_documents` (`tenant_id`,`direction`,`source_id`);--> statement-breakpoint
CREATE TABLE `edi_gateway_tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product` text NOT NULL,
	`source_tenant_id` text NOT NULL,
	`cvr` text NOT NULL,
	`company_name` text NOT NULL,
	`sproom_child_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`receive_enabled` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edi_gateway_tenant_source_unique` ON `edi_gateway_tenants` (`product`,`source_tenant_id`);