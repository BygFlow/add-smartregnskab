-- Customer-confirmed correction on 2026-11-07.
-- All five Lunar accounts are legally owned by ADD Multi Service ApS.
-- Operational allocation by last four digits:
--   Multi Service: 0112 and 4483
--   MultiClean SE 45147592: 6477 and 9507
--   Shared marketing: 9278
--
-- MultiClean invoices 142-154 explicitly instructed customers to pay account
-- ending 0112. The cash therefore landed in ADD Multi Service ApS, although
-- the imported MultiClean ledger posted the receipts to its own bank account.
-- ADD Multi Service already has the matching entries on account 6840.
-- Preserve the imported source journals and add auditable reclassification
-- entries in the MultiClean accounting scope: debit intercompany 6837 and
-- credit bank 5820, total DKK 37,757.51.

UPDATE `accounts`
SET `name` = 'Lunar drift ·0112'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `account_number` = '5820';
--> statement-breakpoint
UPDATE `accounts`
SET `name` = 'Lunar løn og skat ·4483'
WHERE `company_id` IN (
  SELECT `id` FROM `companies`
  WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
)
AND `account_number` = '5825';
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '5826', '6480', 'Lunar marketing ·9278 (fælles)', 'aktiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (
    SELECT 1 FROM `accounts` AS account
    WHERE account.`company_id` = company.`id` AND account.`account_number` = '5826'
  );
--> statement-breakpoint

UPDATE `accounts`
SET `name` = 'Lunar drift ·6477 (MultiClean)'
WHERE `company_id` IN (
  SELECT unit.`accounting_company_id`
  FROM `company_units` AS unit
  WHERE REPLACE(COALESCE(unit.`se_number`, ''), ' ', '') = '45147592'
    AND unit.`accounting_company_id` IS NOT NULL
  UNION
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '45147592'
)
AND `account_number` = '5820';
--> statement-breakpoint
UPDATE `accounts`
SET `name` = 'Lunar løn og moms ·9507 (MultiClean)'
WHERE `company_id` IN (
  SELECT unit.`accounting_company_id`
  FROM `company_units` AS unit
  WHERE REPLACE(COALESCE(unit.`se_number`, ''), ' ', '') = '45147592'
    AND unit.`accounting_company_id` IS NOT NULL
  UNION
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '45147592'
)
AND `account_number` = '5825';
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT scope.`company_id`, '6837', '6330', 'Mellemregning - Multi Service', 'aktiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM (
  SELECT unit.`accounting_company_id` AS `company_id`
  FROM `company_units` AS unit
  WHERE REPLACE(COALESCE(unit.`se_number`, ''), ' ', '') = '45147592'
    AND unit.`accounting_company_id` IS NOT NULL
  UNION
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '45147592'
) AS scope
WHERE NOT EXISTS (
  SELECT 1 FROM `accounts` AS account
  WHERE account.`company_id` = scope.`company_id` AND account.`account_number` = '6837'
);
--> statement-breakpoint

INSERT INTO `journal_entries` (`company_id`, `entry_number`, `date`, `description`, `reference`, `source_type`, `source_id`, `status`, `created_by`, `created_at`)
SELECT scope.`company_id`,
       'REKLASS-2025-0112-' || correction.`invoice_number`,
       correction.`receipt_date`,
       'Ompostering: MultiClean-betaling modtaget på Multi Service-konto ·0112',
       'Faktura ' || correction.`invoice_number` || ' · bankrettelse',
       'bank_reclassification', NULL, 'bogført', 'system@addsmartregnskab.dk', CURRENT_TIMESTAMP
FROM (
  SELECT unit.`accounting_company_id` AS `company_id`
  FROM `company_units` AS unit
  WHERE REPLACE(COALESCE(unit.`se_number`, ''), ' ', '') = '45147592'
    AND unit.`accounting_company_id` IS NOT NULL
  UNION
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '45147592'
) AS scope
JOIN (
  SELECT '142' AS `invoice_number`, '2025-04-19' AS `receipt_date`, 994.00 AS `amount`
  UNION ALL SELECT '143', '2025-04-20', 612.50
  UNION ALL SELECT '144', '2025-05-08', 1050.00
  UNION ALL SELECT '145', '2025-04-16', 2489.06
  UNION ALL SELECT '146', '2025-04-25', 3300.00
  UNION ALL SELECT '147', '2025-04-15', 1490.00
  UNION ALL SELECT '148', '2025-05-07', 1575.00
  UNION ALL SELECT '149', '2025-04-30', 8543.94
  UNION ALL SELECT '150', '2025-04-23', 4812.50
  UNION ALL SELECT '151', '2025-04-23', 2478.00
  UNION ALL SELECT '152', '2025-06-11', 1320.13
  UNION ALL SELECT '153', '2025-04-23', 2600.00
  UNION ALL SELECT '154', '2025-04-22', 6492.38
) AS correction
WHERE NOT EXISTS (
  SELECT 1 FROM `journal_entries` AS entry
  WHERE entry.`company_id` = scope.`company_id`
    AND entry.`entry_number` = 'REKLASS-2025-0112-' || correction.`invoice_number`
);
--> statement-breakpoint

INSERT INTO `journal_lines` (`company_id`, `journal_entry_id`, `account_id`, `description`, `debit`, `credit`, `vat_code`)
SELECT scope.`company_id`, entry.`id`, account.`id`,
       CASE
         WHEN account.`account_number` = '6837'
           THEN 'Tilgodehavende hos ADD Multi Service ApS · faktura ' || correction.`invoice_number`
         ELSE 'Betaling stod fejlagtigt som MultiClean-bank · faktura ' || correction.`invoice_number`
       END,
       CASE WHEN account.`account_number` = '6837' THEN correction.`amount` ELSE 0 END,
       CASE WHEN account.`account_number` = '5820' THEN correction.`amount` ELSE 0 END,
       'ingen'
FROM (
  SELECT unit.`accounting_company_id` AS `company_id`
  FROM `company_units` AS unit
  WHERE REPLACE(COALESCE(unit.`se_number`, ''), ' ', '') = '45147592'
    AND unit.`accounting_company_id` IS NOT NULL
  UNION
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '45147592'
) AS scope
JOIN (
  SELECT '142' AS `invoice_number`, 994.00 AS `amount`
  UNION ALL SELECT '143', 612.50
  UNION ALL SELECT '144', 1050.00
  UNION ALL SELECT '145', 2489.06
  UNION ALL SELECT '146', 3300.00
  UNION ALL SELECT '147', 1490.00
  UNION ALL SELECT '148', 1575.00
  UNION ALL SELECT '149', 8543.94
  UNION ALL SELECT '150', 4812.50
  UNION ALL SELECT '151', 2478.00
  UNION ALL SELECT '152', 1320.13
  UNION ALL SELECT '153', 2600.00
  UNION ALL SELECT '154', 6492.38
) AS correction
JOIN `journal_entries` AS entry
  ON entry.`company_id` = scope.`company_id`
 AND entry.`entry_number` = 'REKLASS-2025-0112-' || correction.`invoice_number`
JOIN `accounts` AS account
  ON account.`company_id` = scope.`company_id`
 AND account.`account_number` IN ('5820', '6837')
WHERE NOT EXISTS (
  SELECT 1 FROM `journal_lines` AS line
  WHERE line.`journal_entry_id` = entry.`id`
);
--> statement-breakpoint

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT scope.`company_id`, NULL, 'system@addsmartregnskab.dk',
       'multiclean_receipts_reclassified', 'journal_entries',
       '{"year":2025,"invoices":"142-154","receiptAccountLast4":"0112","target":"intercompany-6837","entries":13,"amount":37757.51,"reason":"Customer confirmed the payments landed in ADD Multi Service ApS although the revenue belongs to MultiClean SE 45147592."}',
       CURRENT_TIMESTAMP
FROM (
  SELECT unit.`accounting_company_id` AS `company_id`
  FROM `company_units` AS unit
  WHERE REPLACE(COALESCE(unit.`se_number`, ''), ' ', '') = '45147592'
    AND unit.`accounting_company_id` IS NOT NULL
  UNION
  SELECT company.`id`
  FROM `companies` AS company
  WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '45147592'
) AS scope
WHERE EXISTS (
  SELECT 1 FROM `journal_entries` AS entry
  WHERE entry.`company_id` = scope.`company_id`
    AND entry.`entry_number` = 'REKLASS-2025-0112-142'
)
AND NOT EXISTS (
  SELECT 1 FROM `audit_logs` AS log
  WHERE log.`company_id` = scope.`company_id`
    AND log.`action` = 'multiclean_receipts_reclassified'
    AND log.`detail` LIKE '%"amount":37757.51%'
);
--> statement-breakpoint

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT company.`id`, NULL, 'system@addsmartregnskab.dk',
       'lunar_account_allocation_recorded', 'accounts',
       '{"legalOwner":"ADD Multi Service ApS","multiService":["0112","4483"],"multiClean":["6477","9507"],"sharedMarketing":"9278","note":"Last four digits only; operational allocation does not change legal bank ownership."}',
       CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
AND NOT EXISTS (
  SELECT 1 FROM `audit_logs` AS log
  WHERE log.`company_id` = company.`id`
    AND log.`action` = 'lunar_account_allocation_recorded'
);
