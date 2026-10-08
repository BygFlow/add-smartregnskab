CREATE TABLE IF NOT EXISTS `bookkeeping_archive_receipts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `company_id` integer NOT NULL,
  `fiscal_year_start` text NOT NULL,
  `archived_at` text NOT NULL,
  `source_sha256` text NOT NULL,
  `receipt_json` text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bookkeeping_archive_company_year_idx`
  ON `bookkeeping_archive_receipts` (`company_id`, `fiscal_year_start`, `archived_at`);
