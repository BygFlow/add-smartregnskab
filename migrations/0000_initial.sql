CREATE TABLE `absences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`hours_per_day` real DEFAULT 7.4 NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`paid` integer DEFAULT 1 NOT NULL,
	`note` text,
	`approved_by` integer,
	`approved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounting_category_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`industry` text,
	`category_name` text NOT NULL,
	`account_number` text NOT NULL,
	`rule_type` text NOT NULL,
	`vat_treatment` text,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `accounting_exports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` integer NOT NULL,
	`export_date` text NOT NULL,
	`status` text DEFAULT 'eksporteret' NOT NULL,
	`voucher_number` text,
	`account_number` text,
	`amount` real NOT NULL,
	`description` text,
	`exported_by` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounting_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`display_name` text NOT NULL,
	`config` text,
	`status` text DEFAULT 'afbrudt' NOT NULL,
	`last_sync` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounting_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`match_text` text NOT NULL,
	`account_number` text NOT NULL,
	`account_name` text NOT NULL,
	`vat_code` text,
	`category` text DEFAULT 'diverse' NOT NULL,
	`auto_book` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`account_number` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`vat_code` text,
	`balance` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `accruals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`account_number` text,
	`monthly_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `advanced_vat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`vat_type` text NOT NULL,
	`country` text,
	`basis` real DEFAULT 0 NOT NULL,
	`vat_rate` real,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`deduction_rate` real,
	`deductible_amount` real,
	`description` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_accounting_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`data` text,
	`suggestion` text,
	`approved` integer DEFAULT 0,
	`approved_by` text,
	`approved_at` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `ai_drift_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`data` text,
	`suggestion` text,
	`status` text DEFAULT 'afventer' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `annual_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`year` integer NOT NULL,
	`result` real DEFAULT 0 NOT NULL,
	`tax_result` real DEFAULT 0 NOT NULL,
	`balance_total` real DEFAULT 0 NOT NULL,
	`equity` real DEFAULT 0 NOT NULL,
	`xbrl_status` text DEFAULT 'ikke_genereret' NOT NULL,
	`auditor_package` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`submitted_to_erhvervsstyrelsen` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`key_prefix` text,
	`key_hash` text,
	`scopes` text,
	`rate_limit` integer,
	`last_used` text,
	`webhook_url` text,
	`webhook_events` text,
	`webhook_log` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `archive_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`voucher_number` text,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`amount` real,
	`file_name` text,
	`period` text NOT NULL,
	`locked` integer DEFAULT 0 NOT NULL,
	`archive_path` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`task_id` integer,
	`kind` text DEFAULT 'andet' NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`data_url` text,
	`storage` text DEFAULT 'disk' NOT NULL,
	`storage_key` text,
	`inspection_id` integer,
	`uploaded_by` integer,
	`note` text,
	`created_at` text NOT NULL,
	`delete_after` text
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`user_id` integer,
	`user_email` text,
	`action` text NOT NULL,
	`target` text,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_package` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`year` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`content` text,
	`prepared_by` text,
	`reviewed_by` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`signed_off_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auditor_portal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`auditor_name` text,
	`request_type` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`response` text,
	`due_date` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` integer,
	`email` text NOT NULL,
	`company_id` integer,
	`payload` text,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_tokens_token_unique` ON `auth_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `backup_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`scope` text DEFAULT 'company' NOT NULL,
	`status` text DEFAULT 'planlagt' NOT NULL,
	`size` text,
	`destination` text DEFAULT 'cloud',
	`auto_sync` integer DEFAULT 1,
	`summary` text,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backup_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`provider` text DEFAULT 'local' NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'ikke_aktiv' NOT NULL,
	`config` text DEFAULT '{}',
	`auto_sync` integer DEFAULT 0,
	`sync_interval` text DEFAULT 'weekly',
	`sync_day` integer DEFAULT 1,
	`sync_time` text DEFAULT '02:00',
	`retention_days` integer DEFAULT 30,
	`last_sync_at` text,
	`last_sync_status` text,
	`last_sync_size` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`scope` text NOT NULL,
	`status` text DEFAULT 'fuldfort' NOT NULL,
	`size` text,
	`summary` text,
	`created_at` text NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `bank_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`last_sync` text,
	`config` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bank_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`payment_file_id` text,
	`recipient_name` text NOT NULL,
	`recipient_account` text,
	`recipient_reg` text,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'DKK' NOT NULL,
	`payment_date` text,
	`reference` text,
	`message` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`bank_status` text,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`amount` real NOT NULL,
	`balance` real DEFAULT 0,
	`matched_type` text,
	`matched_id` integer,
	`status` text DEFAULT 'afventer' NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budget_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`year` text NOT NULL,
	`scenario` text DEFAULT 'basis' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`data` text,
	`total_revenue` real,
	`total_costs` real,
	`total_result` real,
	`approved_by` text,
	`approved_at` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`year` integer NOT NULL,
	`month` integer,
	`account_number` text,
	`category` text NOT NULL,
	`budgeted_amount` real DEFAULT 0 NOT NULL,
	`actual_amount` real DEFAULT 0 NOT NULL,
	`variance` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `business_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`industry` text NOT NULL,
	`company_type` text,
	`vat_setup` text,
	`reporting_standard` text DEFAULT 'regnskabssætning',
	`fiscal_year_start` text,
	`currency` text DEFAULT 'DKK',
	`default_tax_rate` real DEFAULT 25,
	`dimensions_config` text,
	`custom_fields` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cashflow_projections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`expected_amount` real DEFAULT 0 NOT NULL,
	`actual_amount` real,
	`status` text DEFAULT 'forventet' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`sender_id` integer,
	`sender_name` text,
	`sender_role` text,
	`body` text NOT NULL,
	`attachments` text,
	`read` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `checklist_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`checklist_id` integer NOT NULL,
	`task_id` integer,
	`employee_id` integer NOT NULL,
	`executed_at` text NOT NULL,
	`results` text DEFAULT '[]' NOT NULL,
	`completed_count` integer DEFAULT 0,
	`total_count` integer DEFAULT 0,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chemicals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`hazard_class` text,
	`safety_data_sheet` text,
	`ppe_required` text,
	`instructions` text,
	`supplier` text,
	`purchase_date` text,
	`review_date` text,
	`expiry_date` text,
	`location_id` integer,
	`stock_quantity` real DEFAULT 0,
	`unit` text DEFAULT 'liter',
	`min_stock` real DEFAULT 0,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cleaning_agreements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`frequency` text DEFAULT 'ugentligt' NOT NULL,
	`monthly_price` real DEFAULT 0 NOT NULL,
	`service_ids` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`agreement_number` text,
	`contact_person` text,
	`contact_email` text,
	`contact_phone` text,
	`agreement_lines` text DEFAULT '[]',
	`total_setup` real DEFAULT 0,
	`binding_period` integer DEFAULT 0,
	`notice_period` integer DEFAULT 1,
	`payment_terms` text,
	`terms` text,
	`sent_at` text,
	`customer_approved_at` text,
	`customer_signature` text,
	`cancelled_at` text,
	`cancellation_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cleaning_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`agreement_id` integer,
	`name` text NOT NULL,
	`area` text,
	`tasks` text DEFAULT '[]' NOT NULL,
	`frequency` text DEFAULT 'ugentligt' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`plan_number` text,
	`location` text,
	`areas` text DEFAULT '[]',
	`schedule_type` text DEFAULT 'fast',
	`start_date` text,
	`end_date` text,
	`next_scheduled_date` text,
	`total_estimated_minutes` real DEFAULT 0,
	`checklist_enabled` integer DEFAULT 1,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cleaning_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`unit_type` text DEFAULT 'time' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`hourly_rate` real DEFAULT 0,
	`estimated_hours` real DEFAULT 0,
	`estimated_time` real DEFAULT 0,
	`category` text,
	`active` integer DEFAULT 1 NOT NULL,
	`vat_code` text DEFAULT 'I25',
	`weekend_surcharge` real DEFAULT 0,
	`evening_surcharge` real DEFAULT 0,
	`material_surcharge` real DEFAULT 0,
	`transport_surcharge` real DEFAULT 0,
	`standard_tasks` text DEFAULT '[]',
	`standard_materials` text DEFAULT '[]',
	`item_number` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cloud_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`credentials` text,
	`bucket` text,
	`region` text,
	`status` text DEFAULT 'afbrudt' NOT NULL,
	`last_sync` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `communication_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`provider` text DEFAULT 'email' NOT NULL,
	`from_email` text,
	`from_name` text,
	`status` text DEFAULT 'ikke_aktiv' NOT NULL,
	`config` text DEFAULT '{}',
	`last_sync_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`cvr` text,
	`phone` text,
	`email` text,
	`status` text DEFAULT 'proeve' NOT NULL,
	`kind` text DEFAULT 'kunde' NOT NULL,
	`created_at` text DEFAULT '2026-01-01' NOT NULL,
	`notes` text,
	`vat_rate` real DEFAULT 25 NOT NULL,
	`vat_mode` text DEFAULT 'dansk' NOT NULL,
	`currency` text DEFAULT 'DKK' NOT NULL,
	`retention_time_entries` integer DEFAULT 60 NOT NULL,
	`retention_gps` integer DEFAULT 6 NOT NULL,
	`retention_absences` integer DEFAULT 60 NOT NULL,
	`retention_photos` integer DEFAULT 24 NOT NULL,
	`dpa_accepted_at` text,
	`dpa_accepted_by` text,
	`ai_enabled` integer DEFAULT 0 NOT NULL,
	`notification_prefs` text,
	`website` text,
	`bank_name` text,
	`bank_account` text,
	`iban` text,
	`swift` text,
	`payment_terms` integer DEFAULT 8 NOT NULL,
	`invoice_address` text,
	`invoice_prefix` text DEFAULT 'FA' NOT NULL,
	`invoice_next_number` integer DEFAULT 1 NOT NULL,
	`offer_prefix` text DEFAULT 'TI' NOT NULL,
	`offer_next_number` integer DEFAULT 1 NOT NULL,
	`auto_approve_invoices` integer DEFAULT 0 NOT NULL,
	`auto_add_time_to_invoice` integer DEFAULT 0 NOT NULL,
	`auto_add_materials_to_invoice` integer DEFAULT 0 NOT NULL,
	`opening_hours` text,
	`auto_break_minutes` integer DEFAULT 30 NOT NULL,
	`working_hours_type` text DEFAULT 'interval' NOT NULL,
	`time_report_frequency` text DEFAULT 'monthly' NOT NULL,
	`invoice_standard_text` text,
	`offer_standard_text` text,
	`reminder_standard_text` text
);
--> statement-breakpoint
CREATE TABLE `compliance_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`category` text NOT NULL,
	`check_name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'afventer' NOT NULL,
	`result` text,
	`checked_at` text,
	`notes` text,
	`requires_legal` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compliance_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`version` text DEFAULT '1.0',
	`requires_legal_review` integer DEFAULT true,
	`reviewed_by` text,
	`reviewed_at` text,
	`valid_until` text,
	`content` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`kind` text NOT NULL,
	`granted` integer DEFAULT 0 NOT NULL,
	`granted_at` text,
	`withdrawn_at` text,
	`text_version` text DEFAULT '1.0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consolidation_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`parent_company` text,
	`subsidiary_company` text,
	`type` text NOT NULL,
	`account_number` text,
	`description` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`elimination_type` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contract_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`contract_id` integer,
	`type` text NOT NULL,
	`description` text,
	`old_price` real,
	`new_price` real,
	`adjustment_percentage` real,
	`adjustment_date` text,
	`effective_date` text,
	`notification_sent` integer DEFAULT false,
	`notification_date` text,
	`customer_approved` integer DEFAULT false,
	`approved_date` text,
	`status` text DEFAULT 'udkast' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`contract_number` text NOT NULL,
	`title` text NOT NULL,
	`pricing_model` text DEFAULT 'timepris' NOT NULL,
	`agreed_rate` real DEFAULT 0 NOT NULL,
	`hours_included` real DEFAULT 0,
	`overtime_rate` real DEFAULT 0,
	`frequency` text DEFAULT 'ugentlig' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`notice_months` integer DEFAULT 1 NOT NULL,
	`index_adjustment` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`terms` text
);
--> statement-breakpoint
CREATE TABLE `control_tests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`control_name` text NOT NULL,
	`control_category` text NOT NULL,
	`test_status` text DEFAULT 'ikke_testet' NOT NULL,
	`test_result` text,
	`tested_by` text,
	`tested_at` text,
	`frequency` text,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text DEFAULT 'internal' NOT NULL,
	`title` text,
	`customer_id` integer,
	`participant_ids` text,
	`last_message_at` text,
	`last_message_preview` text,
	`unread_count` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cost_centers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'kunde' NOT NULL,
	`parent_id` integer,
	`revenue` real DEFAULT 0 NOT NULL,
	`costs` real DEFAULT 0 NOT NULL,
	`profit` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer,
	`invoice_id` integer,
	`credit_number` text,
	`amount` real DEFAULT 0 NOT NULL,
	`reason` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `currency_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`date` text NOT NULL,
	`currency` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`rate` real DEFAULT 0 NOT NULL,
	`dkk_amount` real DEFAULT 0 NOT NULL,
	`vat_type` text,
	`description` text,
	`status` text DEFAULT 'ny' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_payment_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`days` integer DEFAULT 30 NOT NULL,
	`is_standard` integer DEFAULT 0,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`task_id` integer,
	`rating` integer NOT NULL,
	`comment` text,
	`category` text,
	`status` text DEFAULT 'ny' NOT NULL,
	`response` text,
	`responded_by` integer,
	`responded_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`customer_name` text,
	`name` text NOT NULL,
	`address` text,
	`zip` text,
	`city` text,
	`contact_person` text,
	`contact_phone` text,
	`contact_email` text,
	`access_instructions` text,
	`key_number` text,
	`alarm_code` text,
	`cleaning_areas` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_portal_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`allow_booking` integer DEFAULT true,
	`allow_approvals` integer DEFAULT true,
	`allow_complaints` integer DEFAULT true,
	`allow_reports` integer DEFAULT true,
	`allow_documents` integer DEFAULT true,
	`allow_invoices` integer DEFAULT false,
	`portal_url` text,
	`theme` text DEFAULT 'light',
	`welcome_message` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `customer_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`tasks_completed` integer DEFAULT 0,
	`total_hours` real DEFAULT 0,
	`deviations_count` integer DEFAULT 0,
	`feedback_avg` real,
	`checklist_completion_rate` real,
	`photos_count` integer DEFAULT 0,
	`report_data` text DEFAULT '{}',
	`generated_at` text NOT NULL,
	`status` text DEFAULT 'genereret' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'ny' NOT NULL,
	`response` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_self_service` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer,
	`customer_name` text NOT NULL,
	`request_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`preferred_date` text,
	`status` text DEFAULT 'modtaget' NOT NULL,
	`response` text,
	`responded_by` text,
	`responded_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`phone` text,
	`contact` text,
	`email` text,
	`hourly_rate` real DEFAULT 350 NOT NULL,
	`lat` real,
	`lng` real,
	`geofence_radius` integer DEFAULT 150 NOT NULL,
	`customer_number` text,
	`contact_person` text,
	`cvr` text,
	`ean` text,
	`payment_terms` text,
	`invoice_email` text,
	`access_notes` text,
	`multiple_addresses` text DEFAULT '[]',
	`customer_type` text DEFAULT 'erhverv',
	`portal_token` text,
	`portal_active` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `dashboard_widgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`widget_type` text NOT NULL,
	`position` integer DEFAULT 0,
	`visible` integer DEFAULT 1 NOT NULL,
	`config` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE `data_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`kind` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` integer NOT NULL,
	`subject_name` text NOT NULL,
	`status` text DEFAULT 'modtaget' NOT NULL,
	`requested_by` text,
	`note` text,
	`result_ref` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `delivery_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text,
	`message` text,
	`status` text DEFAULT 'afsendt' NOT NULL,
	`provider_response` text,
	`sent_at` text,
	`delivered_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deviations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` integer,
	`customer_id` integer,
	`task_id` integer,
	`title` text NOT NULL,
	`description` text,
	`cause` text,
	`category` text NOT NULL,
	`severity` text DEFAULT 'mellem' NOT NULL,
	`responsible_employee_id` integer,
	`deadline` text,
	`status` text DEFAULT 'ny' NOT NULL,
	`corrective_action` text,
	`follow_up_date` text,
	`customer_notified` integer DEFAULT false,
	`resolution` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dimension_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dimension_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dimension_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `document_center` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`category` text NOT NULL,
	`linked_id` integer,
	`title` text NOT NULL,
	`file_name` text,
	`file_type` text,
	`version` integer DEFAULT 1 NOT NULL,
	`uploaded_by` text,
	`description` text,
	`tags` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_inbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text,
	`source` text DEFAULT 'upload' NOT NULL,
	`supplier` text,
	`amount` real,
	`vat_amount` real,
	`vat_rate` real,
	`invoice_date` text,
	`invoice_number` text,
	`suggested_account` text,
	`suggested_category` text,
	`ocr_status` text DEFAULT 'afventer' NOT NULL,
	`ocr_data` text,
	`matched_voucher_id` integer,
	`is_duplicate` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ny' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `einvoice_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`direction` text NOT NULL,
	`invoice_number` text,
	`invoice_id` integer,
	`counterparty_name` text,
	`amount` real,
	`format` text DEFAULT 'OIOUBL',
	`validation_status` text DEFAULT 'afventer',
	`validation_errors` text,
	`routing_status` text DEFAULT 'afventer',
	`status` text DEFAULT 'modtaget' NOT NULL,
	`processed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employee_certifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`issued_date` text,
	`expiry_date` text,
	`issuer` text,
	`certificate_number` text,
	`document_attachment` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employee_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`employee_name` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`file_name` text,
	`issue_date` text,
	`expiry_date` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`role` text DEFAULT 'Rengøringsassistent' NOT NULL,
	`status` text DEFAULT 'ledig' NOT NULL,
	`weekly_hours` integer DEFAULT 37 NOT NULL,
	`employee_number` text,
	`employment_status` text DEFAULT 'aktiv' NOT NULL,
	`start_date` text,
	`end_date` text,
	`position` text,
	`hourly_rate` real DEFAULT 0,
	`monthly_salary` real DEFAULT 0,
	`contract_type` text,
	`manager_id` integer,
	`skills` text DEFAULT '[]',
	`contract_draft` text,
	`contract_file_name` text,
	`contract_uploaded_at` text,
	`gps_required` integer DEFAULT 1,
	`app_access_enabled` integer DEFAULT 1,
	`permissions` text DEFAULT '[]'
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`serial_number` text,
	`purchase_date` text,
	`purchase_price` real,
	`assigned_to` text,
	`location` text,
	`service_interval` integer,
	`last_service_date` text,
	`next_service_date` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `esignatures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`document_type` text NOT NULL,
	`document_title` text NOT NULL,
	`related_id` integer,
	`signer_name` text NOT NULL,
	`signer_email` text NOT NULL,
	`signer_role` text,
	`signature_hash` text,
	`signed_at` text,
	`expires_at` text,
	`status` text DEFAULT 'afventer' NOT NULL,
	`ip` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`customer_id` integer,
	`task_id` integer,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`receipt_image` text,
	`date` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`rejection_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `file_objects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`category` text,
	`uploaded_by` text,
	`storage_path` text,
	`checksum` text,
	`is_virus_scanned` integer DEFAULT false,
	`status` text DEFAULT 'aktiv',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `file_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`file_name` text NOT NULL,
	`storage_path` text NOT NULL,
	`checksum` text,
	`uploaded_by` text,
	`change_note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fixed_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`purchase_date` text NOT NULL,
	`purchase_price` real NOT NULL,
	`salvage_value` real DEFAULT 0 NOT NULL,
	`useful_life` integer NOT NULL,
	`depreciation_method` text DEFAULT 'linear' NOT NULL,
	`accumulated_depreciation` real DEFAULT 0 NOT NULL,
	`book_value` real DEFAULT 0 NOT NULL,
	`monthly_depreciation` real DEFAULT 0 NOT NULL,
	`account_number` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`sold_at` text,
	`sold_price` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`type` text NOT NULL,
	`entity` text NOT NULL,
	`format` text DEFAULT 'csv' NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`row_count` integer DEFAULT 0,
	`error_count` integer DEFAULT 0,
	`errors` text,
	`file_name` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `import_jobs2` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`source` text NOT NULL,
	`file_name` text NOT NULL,
	`status` text DEFAULT 'uploadet' NOT NULL,
	`total_rows` integer,
	`imported_rows` integer,
	`error_rows` integer,
	`preview` text,
	`mapping` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbound_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer,
	`related_type` text,
	`related_id` integer,
	`from_email` text,
	`from_phone` text,
	`body` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `industry_account_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`industry` text NOT NULL,
	`account_number` text NOT NULL,
	`account_name` text NOT NULL,
	`account_type` text NOT NULL,
	`vat_code` text,
	`is_default` integer DEFAULT false,
	`description` text
);
--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`task_id` integer,
	`employee_id` integer,
	`inspector_id` integer,
	`date` text NOT NULL,
	`scores` text DEFAULT '[]' NOT NULL,
	`total_score` real DEFAULT 0 NOT NULL,
	`result` text DEFAULT 'godkendt' NOT NULL,
	`follow_up_date` text,
	`follow_up_done` integer DEFAULT 0 NOT NULL,
	`customer_visible` integer DEFAULT 1 NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `integration_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`provider` text,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'ikke_forbundet' NOT NULL,
	`auth_method` text,
	`config` text,
	`last_sync` text,
	`sync_status` text,
	`error_message` text,
	`api_agreement` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_retry_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`integration_type` text NOT NULL,
	`payload` text,
	`retry_count` integer DEFAULT 0,
	`max_retries` integer DEFAULT 3,
	`next_retry_at` text,
	`status` text DEFAULT 'afventer' NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`integration_type` text NOT NULL,
	`status` text DEFAULT 'startet' NOT NULL,
	`records_processed` integer DEFAULT 0,
	`records_success` integer DEFAULT 0,
	`records_failed` integer DEFAULT 0,
	`error_message` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`category` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'ikke_opsat' NOT NULL,
	`sync_mode` text DEFAULT 'eksport' NOT NULL,
	`api_key` text,
	`api_secret` text,
	`base_url` text,
	`export_format` text,
	`auto_sync` integer DEFAULT 0 NOT NULL,
	`settings_json` text,
	`last_sync_at` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`category` text,
	`unit` text DEFAULT 'stk' NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`min_quantity` real DEFAULT 0 NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`sale_price` real DEFAULT 0 NOT NULL,
	`location` text,
	`supplier` text,
	`auto_reorder` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`total_value` real DEFAULT 0 NOT NULL,
	`location` text,
	`last_count_date` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`amount` real NOT NULL,
	`vat_rate` real DEFAULT 25 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`invoice_number` text NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text,
	`net_amount` real DEFAULT 0 NOT NULL,
	`vat_rate` real DEFAULT 25 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`payment_terms` integer DEFAULT 14 NOT NULL,
	`sent_at` text,
	`paid_at` text,
	`reminder_count` integer DEFAULT 0 NOT NULL,
	`last_reminder_at` text,
	`reminder_fee` real DEFAULT 0 NOT NULL,
	`credited_amount` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job` text NOT NULL,
	`status` text DEFAULT 'koert' NOT NULL,
	`affected` integer DEFAULT 0 NOT NULL,
	`detail` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`entry_number` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`reference` text,
	`source_type` text,
	`source_id` integer,
	`status` text DEFAULT 'kladde' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`journal_entry_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`description` text,
	`debit` real DEFAULT 0 NOT NULL,
	`credit` real DEFAULT 0 NOT NULL,
	`vat_code` text
);
--> statement-breakpoint
CREATE TABLE `key_handovers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`key_id` integer NOT NULL,
	`from_employee_id` integer,
	`to_employee_id` integer,
	`action` text NOT NULL,
	`signed_by` text,
	`date` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`label` text NOT NULL,
	`keyType` text DEFAULT 'noegle' NOT NULL,
	`identifier` text,
	`secret_enc` text,
	`access_note` text,
	`holder_employee_id` integer,
	`status` text DEFAULT 'paa_lager' NOT NULL,
	`deposit` real DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`provider` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'ikke_aktiv' NOT NULL,
	`config` text DEFAULT '{}',
	`auto_import` integer DEFAULT 1,
	`last_sync_at` text,
	`total_imported` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`source` text NOT NULL,
	`customer_name` text,
	`customer_email` text,
	`customer_phone` text,
	`customer_address` text,
	`message` text,
	`status` text DEFAULT 'ny' NOT NULL,
	`ai_analysis` text,
	`ai_offer_draft` text,
	`ai_reply_draft` text,
	`approved_by` integer,
	`approved_at` text,
	`sent_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_board_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`related_id` integer,
	`related_type` text,
	`location` text,
	`timestamp` text NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `location_checklists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`area` text,
	`items` text DEFAULT '[]' NOT NULL,
	`frequency` text DEFAULT 'hver_gang',
	`is_active` integer DEFAULT true,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`ip` text,
	`success` integer DEFAULT 0 NOT NULL,
	`reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`material_id` integer NOT NULL,
	`task_id` integer,
	`customer_id` integer,
	`employee_id` integer,
	`quantity` real NOT NULL,
	`kind` text DEFAULT 'forbrug' NOT NULL,
	`billable` integer DEFAULT 1 NOT NULL,
	`invoiced_at` text,
	`date` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`unit` text DEFAULT 'stk' NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`sales_price` real DEFAULT 0 NOT NULL,
	`stock` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`supplier` text,
	`hazardous` integer DEFAULT 0 NOT NULL,
	`safety_sheet_url` text,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'i_koe' NOT NULL,
	`related_type` text,
	`related_id` integer,
	`error` text,
	`created_at` text NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE TABLE `migration_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`source` text NOT NULL,
	`source_version` text,
	`file_name` text,
	`mapping` text,
	`total_rows` integer,
	`imported_rows` integer DEFAULT 0,
	`error_rows` integer DEFAULT 0,
	`validation_errors` text,
	`rollback_available` integer DEFAULT true,
	`rolled_back_at` text,
	`status` text DEFAULT 'uploadet' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mileage_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`customer_id` integer,
	`task_id` integer,
	`date` text NOT NULL,
	`start_address` text NOT NULL,
	`end_address` text NOT NULL,
	`kilometers` real NOT NULL,
	`purpose` text NOT NULL,
	`rate` real DEFAULT 3.7 NOT NULL,
	`compensation` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`rejection_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mobile_sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer,
	`employee_name` text,
	`device_info` text,
	`sync_type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`synced_at` text,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `navigation_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`company_id` integer,
	`path` text NOT NULL,
	`label` text NOT NULL,
	`platform` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`user_id` integer,
	`title` text NOT NULL,
	`message` text,
	`type` text DEFAULT 'info' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offline_conflicts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`employee_name` text,
	`sync_type` text NOT NULL,
	`local_data` text,
	`server_data` text,
	`conflict_type` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`resolved_by` text,
	`resolution` text,
	`resolved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outbound_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer,
	`related_type` text,
	`related_id` integer,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient_name` text,
	`recipient_email` text,
	`recipient_phone` text,
	`subject` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`ai_generated` integer DEFAULT 0 NOT NULL,
	`approved_by` integer,
	`approved_at` text,
	`sent_at` text,
	`error_message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text NOT NULL,
	`brand` text,
	`last4` text,
	`exp_month` integer,
	`exp_year` integer,
	`is_default` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`provider` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'ikke_aktiv' NOT NULL,
	`config` text DEFAULT '{}',
	`auto_setup` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`run_date` text NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`payment_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`export_file` text,
	`approved_by` text,
	`approved_at` text,
	`items` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`platform_invoice_id` integer,
	`payment_method_id` integer,
	`provider` text NOT NULL,
	`provider_ref` text,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'DKK' NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`failure_reason` text,
	`attempt` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`settled_at` text
);
--> statement-breakpoint
CREATE TABLE `payroll_calculations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`employee_name` text,
	`period` text NOT NULL,
	`base_hours` real,
	`overtime_hours` real,
	`holiday_hours` real,
	`night_hours` real,
	`weekend_hours` real,
	`base_pay` real,
	`overtime_pay` real,
	`holiday_pay` real,
	`night_surcharge` real,
	`weekend_surcharge` real,
	`kilometers` real,
	`mileage_allowance` real,
	`pension` real,
	`atp` real,
	`am_contribution` real,
	`a_tax` real,
	`gross_salary` real,
	`net_salary` real,
	`vacation_pay` real,
	`status` text DEFAULT 'kladde' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_engine` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`employee_name` text,
	`period` text NOT NULL,
	`payslip_number` text,
	`gross_salary` real,
	`a_tax` real,
	`atp` real,
	`am_contribution` real,
	`holiday_pay` real,
	`pension` real,
	`health_insurance` real,
	`union_contribution` real,
	`net_salary` real,
	`hours` real,
	`hourly_rate` real,
	`overtime` real,
	`mileage` real,
	`deductions` real,
	`eindkomst_status` text DEFAULT 'ikke_sendt',
	`feriekonto_status` text DEFAULT 'ikke_sendt',
	`status` text DEFAULT 'kladde' NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`employee_name` text NOT NULL,
	`period` text NOT NULL,
	`regular_hours` real DEFAULT 0 NOT NULL,
	`overtime_hours` real DEFAULT 0 NOT NULL,
	`hourly_rate` real DEFAULT 0 NOT NULL,
	`gross_salary` real DEFAULT 0 NOT NULL,
	`holiday_pay` real DEFAULT 0 NOT NULL,
	`pension` real DEFAULT 0 NOT NULL,
	`atp` real DEFAULT 0 NOT NULL,
	`a_tax` real DEFAULT 0 NOT NULL,
	`am_contribution` real DEFAULT 0 NOT NULL,
	`net_salary` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`journal_entry_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`gross_total` real DEFAULT 0 NOT NULL,
	`tax_total` real DEFAULT 0 NOT NULL,
	`holiday_pay_total` real DEFAULT 0 NOT NULL,
	`pension_total` real DEFAULT 0 NOT NULL,
	`atp_total` real DEFAULT 0 NOT NULL,
	`am_contribution_total` real DEFAULT 0 NOT NULL,
	`net_total` real DEFAULT 0 NOT NULL,
	`eindkomst_status` text DEFAULT 'ikke_sendt' NOT NULL,
	`feriekonto_status` text DEFAULT 'ikke_sendt' NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`submitted_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `period_closes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period_type` text NOT NULL,
	`period_label` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'aabne' NOT NULL,
	`checklist` text DEFAULT '[]' NOT NULL,
	`closed_by` text,
	`closed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`monthly_price` real NOT NULL,
	`price_per_employee` real DEFAULT 0 NOT NULL,
	`max_employees` integer DEFAULT 10 NOT NULL,
	`max_customers` integer DEFAULT 25 NOT NULL,
	`features` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_slug_unique` ON `plans` (`slug`);--> statement-breakpoint
CREATE TABLE `platform_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`subscription_id` integer NOT NULL,
	`invoice_number` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`plan_name` text NOT NULL,
	`employee_count` integer DEFAULT 0 NOT NULL,
	`net_amount` real NOT NULL,
	`vat_amount` real NOT NULL,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'udstedt' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE TABLE `platform_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`company_name` text NOT NULL,
	`plan` text DEFAULT 'basis' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`max_users` integer,
	`max_employees` integer,
	`ai_enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`trial_ends_at` text,
	`next_billing_date` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platform_sync_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_platform` text NOT NULL,
	`target_platform` text NOT NULL,
	`sync_type` text NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`total_records` integer DEFAULT 0,
	`synced_records` integer DEFAULT 0,
	`error_records` integer DEFAULT 0,
	`error_message` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platform_sync_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`source_platform` text NOT NULL,
	`target_platform` text NOT NULL,
	`status` text DEFAULT 'synkroniseret' NOT NULL,
	`last_synced_at` text
);
--> statement-breakpoint
CREATE TABLE `portal_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer,
	`title` text NOT NULL,
	`document_type` text NOT NULL,
	`file_name` text,
	`file_type` text,
	`visible_to_customer` integer DEFAULT true,
	`uploaded_by` text,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`product_number` text,
	`name` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'ydelse' NOT NULL,
	`unit` text DEFAULT 'stk' NOT NULL,
	`sales_price` real DEFAULT 0 NOT NULL,
	`cost_price` real DEFAULT 0,
	`vat_rate` real DEFAULT 25 NOT NULL,
	`account_number` text,
	`inventory_tracked` integer DEFAULT false,
	`stock_quantity` integer DEFAULT 0,
	`min_stock` integer DEFAULT 0,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `profitability_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`entity_name` text,
	`period` text NOT NULL,
	`revenue` real DEFAULT 0 NOT NULL,
	`labor_cost` real DEFAULT 0 NOT NULL,
	`material_cost` real DEFAULT 0 NOT NULL,
	`transport_cost` real DEFAULT 0 NOT NULL,
	`overhead` real DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`profit` real DEFAULT 0 NOT NULL,
	`margin` real DEFAULT 0 NOT NULL,
	`hours_worked` real,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`po_number` text,
	`supplier` text NOT NULL,
	`supplier_email` text,
	`supplier_phone` text,
	`items` text,
	`total_amount` real,
	`status` text DEFAULT 'kladde' NOT NULL,
	`expected_date` text,
	`received_date` text,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`company_id` integer,
	`endpoint` text NOT NULL,
	`p256dh` text,
	`auth` text,
	`user_agent` text,
	`is_active` integer DEFAULT true,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qr_checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`customer_location_id` integer,
	`task_id` integer,
	`checklist_id` integer,
	`employee_id` integer NOT NULL,
	`check_in_time` text NOT NULL,
	`check_out_time` text,
	`before_photos` text DEFAULT '[]',
	`after_photos` text DEFAULT '[]',
	`notes` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quality_inspections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`task_id` integer,
	`customer_name` text,
	`inspector_name` text NOT NULL,
	`date` text NOT NULL,
	`score` real,
	`max_score` real DEFAULT 100 NOT NULL,
	`checklist` text,
	`deviations` text,
	`photos` text,
	`status` text DEFAULT 'afventer' NOT NULL,
	`corrective_actions` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quote_id` integer NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'timer' NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`amount` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`quote_number` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`net_amount` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'kladde' NOT NULL,
	`valid_until` text,
	`issue_date` text NOT NULL,
	`responded_at` text,
	`customer_message` text,
	`contract_id` integer
);
--> statement-breakpoint
CREATE TABLE `reconciliation_center` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`type` text NOT NULL,
	`account_number` text,
	`book_amount` real,
	`external_amount` real,
	`difference` real,
	`matched_transactions` integer,
	`unmatched_transactions` integer,
	`auto_matched` integer,
	`status` text DEFAULT 'afventer' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`next_date` text NOT NULL,
	`net_amount` real DEFAULT 0 NOT NULL,
	`vat_rate` real DEFAULT 25 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`items` text,
	`payment_terms` text DEFAULT '14',
	`auto_send` integer DEFAULT false,
	`is_active` integer DEFAULT true,
	`last_invoice_id` integer,
	`last_run_date` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminder_flow` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`invoice_id` integer NOT NULL,
	`invoice_number` text,
	`customer_name` text,
	`amount` real DEFAULT 0 NOT NULL,
	`days_overdue` integer DEFAULT 0 NOT NULL,
	`reminder_level` integer DEFAULT 1 NOT NULL,
	`reminder_fee` real DEFAULT 0 NOT NULL,
	`interest` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`sent_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_controls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`role_name` text NOT NULL,
	`module` text NOT NULL,
	`can_create` integer DEFAULT 0 NOT NULL,
	`can_edit` integer DEFAULT 0 NOT NULL,
	`can_delete` integer DEFAULT 0 NOT NULL,
	`can_approve` integer DEFAULT 0 NOT NULL,
	`approval_limit` real,
	`requires_two_factor` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`date` text NOT NULL,
	`driver_id` integer,
	`driver_name` text,
	`vehicle_id` integer,
	`zone` text,
	`stops` text,
	`total_distance` real,
	`total_time` real,
	`status` text DEFAULT 'planlagt' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales_pipeline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`lead_name` text NOT NULL,
	`contact_person` text,
	`phone` text,
	`email` text,
	`address` text,
	`source` text,
	`stage` text DEFAULT 'ny' NOT NULL,
	`estimated_value` real,
	`probability` real DEFAULT 0 NOT NULL,
	`expected_close_date` text,
	`notes` text,
	`lost_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `security_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`user_id` text,
	`event_type` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`action` text,
	`ip_address` text,
	`user_agent` text,
	`result` text DEFAULT 'success',
	`details` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`contract_number` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`type` text NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`billing_cycle` text DEFAULT 'maanedlig' NOT NULL,
	`sla_level` text,
	`description` text,
	`auto_renew` integer DEFAULT 1 NOT NULL,
	`price_index` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `service_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_name` text,
	`location_name` text,
	`task_type` text,
	`date` text NOT NULL,
	`employee_name` text,
	`before_photos` text,
	`after_photos` text,
	`notes` text,
	`rating` integer,
	`status` text DEFAULT 'afsluttet' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`customer_id` integer,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`status` text DEFAULT 'planlagt' NOT NULL,
	`note` text,
	`published` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sla_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`alert_type` text NOT NULL,
	`task_id` integer,
	`customer_id` integer,
	`employee_id` integer,
	`severity` text DEFAULT 'mellem' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`resolved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`plan_id` integer NOT NULL,
	`status` text DEFAULT 'proeve' NOT NULL,
	`billing_cycle` text DEFAULT 'maanedlig' NOT NULL,
	`trial_ends_at` text,
	`current_period_start` text NOT NULL,
	`current_period_end` text NOT NULL,
	`cancelled_at` text,
	`started_at` text NOT NULL,
	`auto_renew` integer DEFAULT 1 NOT NULL,
	`payment_method_id` integer,
	`dunning_stage` integer DEFAULT 0 NOT NULL,
	`last_payment_attempt` text
);
--> statement-breakpoint
CREATE TABLE `substitution_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`absence_id` integer,
	`original_employee_id` integer NOT NULL,
	`suggested_employee_id` integer NOT NULL,
	`shift_id` integer,
	`task_id` integer,
	`reason` text,
	`score` real DEFAULT 0,
	`status` text DEFAULT 'foreslaaet' NOT NULL,
	`responded_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`supplier_number` text,
	`name` text NOT NULL,
	`cvr` text,
	`ean` text,
	`address` text,
	`phone` text,
	`email` text,
	`invoice_email` text,
	`contact_person` text,
	`payment_terms` text DEFAULT '30',
	`bank_account` text,
	`notes` text,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `support_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'aabn' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`reply` text,
	`reply_status` text DEFAULT 'kladde' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`integration_id` integer NOT NULL,
	`provider` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`message` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_health_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`component` text NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`severity` text DEFAULT 'info',
	`message` text,
	`metrics` text,
	`resolved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`features` text,
	`status` text DEFAULT 'installeret' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`employee_id` integer,
	`user_id` integer,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`started_at` text NOT NULL,
	`paused_at` text,
	`resumed_at` text,
	`ended_at` text,
	`pause_reason` text,
	`total_pause_minutes` integer DEFAULT 0,
	`duration_minutes` integer,
	`gps_lat` text,
	`gps_lng` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`title` text NOT NULL,
	`customer_id` integer,
	`employee_id` integer,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`status` text DEFAULT 'planlagt' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`description` text,
	`checklist` text,
	`recurrence` text DEFAULT 'ingen' NOT NULL,
	`recurrence_end_date` text,
	`parent_task_id` integer
);
--> statement-breakpoint
CREATE TABLE `tax_deadlines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`period` text,
	`deadline` text NOT NULL,
	`amount` real DEFAULT 0,
	`status` text DEFAULT 'afventer' NOT NULL,
	`submitted_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`logo_position` text DEFAULT 'left',
	`primary_color` text DEFAULT '#2176d4',
	`header_layout` text DEFAULT 'classic',
	`show_bank_info` integer DEFAULT 1,
	`show_payment_terms` integer DEFAULT 1,
	`show_ean` integer DEFAULT 0,
	`columns` text DEFAULT '[]',
	`footer_text` text,
	`terms_conditions` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`task_id` integer,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration_minutes` integer,
	`note` text,
	`check_in_lat` real,
	`check_in_lng` real,
	`check_out_lat` real,
	`check_out_lng` real,
	`check_in_distance` integer,
	`check_out_distance` integer,
	`geofence_status` text DEFAULT 'ukendt' NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'assistent' NOT NULL,
	`employee_id` integer,
	`customer_id` integer,
	`active` integer DEFAULT 1 NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`two_factor_secret` text,
	`two_factor_enabled` integer DEFAULT 0 NOT NULL,
	`two_factor_backup` text,
	`locked_until` text,
	`last_login_at` text,
	`password_changed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vat_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`vat_type` text DEFAULT 'kvartal' NOT NULL,
	`output_vat` real DEFAULT 0 NOT NULL,
	`input_vat` real DEFAULT 0 NOT NULL,
	`net_vat` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aabn' NOT NULL,
	`reported_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vat_reconciliations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period` text NOT NULL,
	`output_vat` real DEFAULT 0 NOT NULL,
	`input_vat` real DEFAULT 0 NOT NULL,
	`net_vat` real DEFAULT 0 NOT NULL,
	`skat_account` real DEFAULT 0 NOT NULL,
	`difference` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'afventer' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicle_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`date` text NOT NULL,
	`start_mileage` integer,
	`end_mileage` integer,
	`distance` integer,
	`purpose` text,
	`fuel_amount` real,
	`fuel_cost` real,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`plate_number` text NOT NULL,
	`brand` text,
	`model` text,
	`year` integer,
	`color` text,
	`fuel_type` text DEFAULT 'benzin',
	`mileage` integer DEFAULT 0,
	`insurance_expiry` text,
	`inspection_expiry` text,
	`service_due` text,
	`assigned_to` integer,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`voucher_number` text NOT NULL,
	`supplier` text,
	`date` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0,
	`vat_rate` real DEFAULT 0.25,
	`description` text,
	`category` text,
	`account_id` text,
	`status` text DEFAULT 'kladde' NOT NULL,
	`ai_suggested` integer DEFAULT 0,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`signature_valid` integer DEFAULT 0 NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`error` text,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_event_id_unique` ON `webhook_events` (`event_id`);--> statement-breakpoint
CREATE TABLE `workflow_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`name` text NOT NULL,
	`trigger` text NOT NULL,
	`steps` text NOT NULL,
	`is_active` integer DEFAULT true,
	`description` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workflow_id` integer NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'startet' NOT NULL,
	`current_step` integer DEFAULT 0,
	`total_steps` integer DEFAULT 0,
	`result` text,
	`error_message` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workplace_incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`date` text NOT NULL,
	`location` text,
	`involved_employee` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`chemical_name` text,
	`sds_number` text,
	`reported_by` text,
	`actions` text,
	`status` text DEFAULT 'rapporteret' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `year_end_closes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`year` integer NOT NULL,
	`status` text DEFAULT 'aabne' NOT NULL,
	`result` real DEFAULT 0 NOT NULL,
	`tax_result` real DEFAULT 0 NOT NULL,
	`checklist` text DEFAULT '[]' NOT NULL,
	`auditor_package` text,
	`closed_by` text,
	`closed_at` text,
	`created_at` text NOT NULL
);
