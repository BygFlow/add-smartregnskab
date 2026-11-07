-- Customer-confirmed bank history on 2026-11-07.
-- From 2026-03-04, the Nordea operating account ending 5361 was used at the
-- same time as Lunar account ending 0112. The imported e-conomic account plan
-- keeps both operating accounts in ledger account 5820, so do not invent a
-- separate balance. Show the concurrent bank history in the account label.

UPDATE `accounts`
SET `name` = 'Bankdrift · Danske 0707 (historisk) / Lunar ·0112 + Nordea ·5361 fra 04-03-2026'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `account_number` = '5820';
--> statement-breakpoint

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT company.`id`, NULL, 'system@addsmartregnskab.dk',
       'concurrent_bank_account_recorded', 'accounts',
       '{"ledgerAccount":"5820","bank":"Nordea","registration":"2355","accountLast4":"5361","activeFrom":"2026-03-04","concurrentWith":"Lunar-0112","note":"The source account plan aggregates both operating bank accounts in ledger account 5820; the full account number is deliberately not stored in the public migration."}',
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
    AND log.`action` = 'concurrent_bank_account_recorded'
    AND log.`detail` LIKE '%"accountLast4":"5361"%'
);
