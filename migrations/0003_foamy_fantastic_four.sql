ALTER TABLE `einvoice_queue` ADD `document_type` text DEFAULT 'invoice' NOT NULL;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `recipient_endpoint_id` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `endpoint_scheme` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `payload_xml` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `provider_message_id` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `response_type` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `received_at` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `sent_at` text;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `einvoice_queue` ADD `last_error` text;