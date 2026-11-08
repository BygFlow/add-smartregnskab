-- Customer-confirmed deletion on 2026-11-08.
-- ADD SmartDrift ApS was connected to Mastercard AiiA's TestDataBank1 sandbox.
-- The 972 imported rows are synthetic test data and must not be used for
-- bookkeeping. Fail closed if a partial or unexpected batch is present.

CREATE TEMP TABLE `smartdrift_aiia_test_cleanup_guard` (
  `row_count` integer NOT NULL CHECK (`row_count` IN (0, 972))
);
--> statement-breakpoint
INSERT INTO `smartdrift_aiia_test_cleanup_guard` (`row_count`)
SELECT COUNT(*)
FROM `bank_transactions` AS tx
WHERE tx.`company_id` IN (
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '46761898'
)
AND tx.`provider` = 'aiia'
AND tx.`account_ref` IN (
  'MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8SGllbFB2d21iTnp0cFJibUVfWVJnTVJnMXUxMGRzZVd4dzNGTDVSSDRMOC4xNjZlZjcwMDVjOGI=',
  'MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8UnRvQUdPeHFlMk5nLUhUS09SZFVWMG1DWkdFYUdmLWQyWjZWVVNnTDRicy5jODFjMDE4MzFhOGY='
)
AND tx.`external_id` LIKE 'aiia:' || tx.`account_ref` || ':%';
--> statement-breakpoint
INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT
  company.`id`,
  NULL,
  'system@addsmartregnskab.dk',
  'aiia_test_bank_deleted',
  'bank_transactions',
  '{"provider":"aiia","source":"TestDataBank1","accounts":2,"deletedRows":972,"reason":"Customer confirmed that the synthetic AiiA sandbox transactions must be removed from ADD SmartDrift ApS."}',
  CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '46761898'
AND (SELECT `row_count` FROM `smartdrift_aiia_test_cleanup_guard`) = 972
LIMIT 1;
--> statement-breakpoint
DELETE FROM `bank_transactions`
WHERE `company_id` IN (
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '46761898'
)
AND `provider` = 'aiia'
AND `account_ref` IN (
  'MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8SGllbFB2d21iTnp0cFJibUVfWVJnTVJnMXUxMGRzZVd4dzNGTDVSSDRMOC4xNjZlZjcwMDVjOGI=',
  'MTM2MmJhYTktMjFjNS00MmZiLWEwYjEtODAyZjgzN2ZhZTdmfFRlc3REYXRhQmFuazF8UnRvQUdPeHFlMk5nLUhUS09SZFVWMG1DWkdFYUdmLWQyWjZWVVNnTDRicy5jODFjMDE4MzFhOGY='
)
AND `external_id` LIKE 'aiia:' || `account_ref` || ':%';
--> statement-breakpoint
DROP TABLE `smartdrift_aiia_test_cleanup_guard`;
