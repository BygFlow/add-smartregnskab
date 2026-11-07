-- Customer-confirmed bank history on 2026-11-07.
-- ADD Multi Service used Danske Bank account 13800707 before Lunar account
-- ending 0112. Both periods share ledger account 5820 in the imported books,
-- so keep one continuous balance and make the account transition explicit.

UPDATE `accounts`
SET `name` = 'Bankdrift · Danske Bank 13800707 (historisk) / Lunar ·0112'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `account_number` = '5820';
--> statement-breakpoint

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT company.`id`, NULL, 'system@addsmartregnskab.dk',
       'bank_account_history_recorded', 'accounts',
       '{"ledgerAccount":"5820","periods":[{"bank":"Danske Bank","account":"13800707","status":"historical"},{"bank":"Lunar","accountLast4":"0112","status":"successor"}],"note":"The imported bookkeeping uses one continuous ledger account; no original transactions were changed."}',
       CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
AND EXISTS (
  SELECT 1 FROM `accounts` AS account
  WHERE account.`company_id` = company.`id` AND account.`account_number` = '5820'
)
AND NOT EXISTS (
  SELECT 1 FROM `audit_logs` AS log
  WHERE log.`company_id` = company.`id`
    AND log.`action` = 'bank_account_history_recorded'
    AND log.`detail` LIKE '%13800707%'
);
