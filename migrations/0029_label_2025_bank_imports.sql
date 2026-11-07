-- Customer-confirmed account ownership on 2026-11-07.
-- The CSV importer did not ask for an account reference, so the five observed
-- import batches are labelled by their exact import windows. This does not
-- change amounts, dates, statuses or bookkeeping; it only records which bank
-- account each imported row came from.
--
-- ADD Multi Service ApS (CVR 44822539):
--   Lunar operating account ·0112       747 rows
--   Lunar payroll/tax account ·4483     179 rows
--   Shared marketing account ·9278      157 rows
--   Danske Bank account 13800707        214 rows for 2025
--   Rejected duplicate 2024 batch        43 rows (already ignored)

UPDATE `bank_transactions`
SET `account_ref` = '0112'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `provider` = 'csv'
AND `account_ref` IS NULL
AND `date` BETWEEN '2025-01-01' AND '2025-12-31'
AND `imported_at` >= '2026-11-07T12:49:31.000Z'
AND `imported_at` < '2026-11-07T12:49:34.000Z';
--> statement-breakpoint
UPDATE `bank_transactions`
SET `account_ref` = '4483'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `provider` = 'csv'
AND `account_ref` IS NULL
AND `date` BETWEEN '2025-01-01' AND '2025-12-31'
AND `imported_at` >= '2026-11-07T12:50:08.000Z'
AND `imported_at` < '2026-11-07T12:50:11.000Z';
--> statement-breakpoint
UPDATE `bank_transactions`
SET `account_ref` = '9278'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `provider` = 'csv'
AND `account_ref` IS NULL
AND `date` BETWEEN '2025-01-01' AND '2025-12-31'
AND `imported_at` >= '2026-11-07T12:51:27.000Z'
AND `imported_at` < '2026-11-07T12:51:30.000Z';
--> statement-breakpoint
UPDATE `bank_transactions`
SET `account_ref` = '13800707'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `provider` = 'csv'
AND `account_ref` IS NULL
AND `date` BETWEEN '2025-01-01' AND '2025-12-31'
AND `imported_at` >= '2026-11-07T12:52:41.000Z'
AND `imported_at` < '2026-11-07T12:52:45.000Z';
--> statement-breakpoint
UPDATE `bank_transactions`
SET `account_ref` = '13800707'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `provider` = 'csv'
AND `account_ref` IS NULL
AND `date` BETWEEN '2024-12-02' AND '2024-12-31'
AND `imported_at` >= '2026-11-07T12:50:34.000Z'
AND `imported_at` < '2026-11-07T12:50:35.000Z';
--> statement-breakpoint
INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT company.`id`, NULL, 'system@addsmartregnskab.dk',
       'bank_import_accounts_labelled', 'bank_transactions',
       '{"0112":747,"4483":179,"9278":157,"13800707_2025":214,"13800707_ignored_2024":43,"reason":"Customer-confirmed bank ownership; exact import windows used because the CSV importer stored null account references.","changesBookkeeping":false}',
       CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
AND EXISTS (
  SELECT 1 FROM `bank_transactions` AS tx
  WHERE tx.`company_id` = company.`id`
    AND tx.`account_ref` IN ('0112', '4483', '9278', '13800707')
    AND tx.`imported_at` >= '2026-11-07T12:49:31.000Z'
    AND tx.`imported_at` < '2026-11-07T12:52:45.000Z'
)
AND NOT EXISTS (
  SELECT 1 FROM `audit_logs` AS log
  WHERE log.`company_id` = company.`id`
    AND log.`action` = 'bank_import_accounts_labelled'
    AND log.`detail` LIKE '%"0112":747%'
);
