ALTER TABLE `company_units` ADD `accounting_company_id` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `company_units_accounting_company_unique` ON `company_units` (`accounting_company_id`);
