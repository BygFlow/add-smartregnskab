ALTER TABLE `bank_transactions` ADD `provider` text;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `account_ref` text;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `external_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_transactions_company_external_unique` ON `bank_transactions` (`company_id`,`external_id`);
