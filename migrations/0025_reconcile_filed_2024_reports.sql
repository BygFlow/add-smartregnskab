-- Post the documented 2024 year-end adjustments behind the already filed
-- annual reports. The imported e-conomic journals remain untouched; these
-- entries are separate, locked year-end journals with deterministic numbers.

-- ADD Multi Service ApS (CVR 44822539): ensure the six accounts used by the
-- filed-report reconciliation exist. Existing imported accounts win.
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '3640', '2670', 'Revisor', 'udgift', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '3640');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '3940', '3050', 'Afskrivning, driftsmidler og inventar', 'udgift', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '3940');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '4820', '3760', 'Regulering af udskudt skat', 'udgift', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '4820');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '5227', '5610', 'Driftsmidler, årets afskrivninger', 'aktiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '5227');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '6310', '6305', 'Udskudt skatteaktiv', 'aktiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '6310');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '6800', '7440', 'Kreditorer', 'passiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '6800');
--> statement-breakpoint

INSERT INTO `journal_entries` (`company_id`, `entry_number`, `date`, `description`, `reference`, `source_type`, `source_id`, `status`, `created_by`, `created_at`)
SELECT company.`id`, 'AFSLUT-2024-001', '2024-12-31',
       'Årsafslutning 2024 jf. indsendt årsrapport',
       'Årsrapport 2024 · offentliggjort 01-08-2025',
       'aarsafslutning', NULL, 'bogført', 'system@addsmartregnskab.dk', CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND EXISTS (
    SELECT 1 FROM `annual_reports` AS report
    WHERE report.`company_id` = company.`id` AND report.`year` = 2024 AND report.`result` = -134428
  )
  AND NOT EXISTS (
    SELECT 1 FROM `journal_entries` AS entry
    WHERE entry.`company_id` = company.`id` AND entry.`entry_number` = 'AFSLUT-2024-001'
  );
--> statement-breakpoint

INSERT INTO `journal_lines` (`company_id`, `journal_entry_id`, `account_id`, `description`, `debit`, `credit`, `vat_code`)
SELECT company.`id`, entry.`id`, account.`id`, adjustment.`description`, adjustment.`debit`, adjustment.`credit`, 'ingen'
FROM `companies` AS company
JOIN `journal_entries` AS entry
  ON entry.`company_id` = company.`id` AND entry.`entry_number` = 'AFSLUT-2024-001'
JOIN (
  SELECT '3640' AS `account_number`, 'Revisorhonorar 2024, periodiseret uden moms' AS `description`, 26000.0 AS `debit`, 0.0 AS `credit`
  UNION ALL SELECT '6800', 'Skyldigt revisorhonorar 2024', 0.0, 26000.0
  UNION ALL SELECT '3940', 'Årets afskrivning på driftsmidler', 1555.0, 0.0
  UNION ALL SELECT '5227', 'Årets afskrivning på driftsmidler', 0.0, 1555.0
  UNION ALL SELECT '6310', 'Udskudt skatteaktiv jf. årsrapport', 37662.0, 0.0
  UNION ALL SELECT '4820', 'Skatteindtægt ved regulering af udskudt skat', 0.0, 37662.0
) AS adjustment
JOIN `accounts` AS account
  ON account.`id` = (
    SELECT MIN(candidate.`id`) FROM `accounts` AS candidate
    WHERE candidate.`company_id` = company.`id`
      AND candidate.`account_number` = adjustment.`account_number`
  )
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (
    SELECT 1 FROM `journal_lines` AS line WHERE line.`journal_entry_id` = entry.`id`
  );
--> statement-breakpoint

-- ADD Group ApS (CVR 44818566): the filed balance consists of the DKK 40,000
-- investment in the subsidiary, DKK 6,250 accrued auditor fee and DKK 1,375
-- deferred-tax asset.
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '2670', '2670', 'Revision og regnskabsmæssig assistance', 'udgift', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '2670');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '3760', '3760', 'Årets regulering af udskudt skat', 'udgift', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '3760');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '5810', '5810', 'Kapitalandele i tilknyttede virksomheder, årets tilgange', 'aktiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '5810');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '6305', '6305', 'Udskudte skatteaktiver', 'aktiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '6305');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '6510', '6510', 'Registreret kapital', 'passiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '6510');
--> statement-breakpoint
INSERT INTO `accounts` (`company_id`, `account_number`, `standard_account_number`, `name`, `type`, `vat_code`, `balance`, `active`, `created_at`)
SELECT company.`id`, '7440', '7440', 'Leverandører af varer og tjenesteydelser', 'passiv', NULL, 0, 1, CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (SELECT 1 FROM `accounts` AS account WHERE account.`company_id` = company.`id` AND account.`account_number` = '7440');
--> statement-breakpoint

INSERT INTO `journal_entries` (`company_id`, `entry_number`, `date`, `description`, `reference`, `source_type`, `source_id`, `status`, `created_by`, `created_at`)
SELECT company.`id`, 'AFSLUT-2024-001', '2024-12-31',
       'Årsafslutning 2024 jf. indsendt årsrapport',
       'Årsrapport 2024 · offentliggjort 01-08-2025',
       'aarsafslutning', NULL, 'bogført', 'system@addsmartregnskab.dk', CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND EXISTS (
    SELECT 1 FROM `annual_reports` AS report
    WHERE report.`company_id` = company.`id` AND report.`year` = 2024 AND report.`result` = -4875
  )
  AND NOT EXISTS (
    SELECT 1 FROM `journal_entries` AS entry
    WHERE entry.`company_id` = company.`id` AND entry.`entry_number` = 'AFSLUT-2024-001'
  );
--> statement-breakpoint

INSERT INTO `journal_lines` (`company_id`, `journal_entry_id`, `account_id`, `description`, `debit`, `credit`, `vat_code`)
SELECT company.`id`, entry.`id`, account.`id`, adjustment.`description`, adjustment.`debit`, adjustment.`credit`, 'ingen'
FROM `companies` AS company
JOIN `journal_entries` AS entry
  ON entry.`company_id` = company.`id` AND entry.`entry_number` = 'AFSLUT-2024-001'
JOIN (
  SELECT '5810' AS `account_number`, 'Kapitalandel i ADD Multi Service ApS' AS `description`, 40000.0 AS `debit`, 0.0 AS `credit`
  UNION ALL SELECT '6510', 'Registreret selskabskapital', 0.0, 40000.0
  UNION ALL SELECT '2670', 'Revisorhonorar 2024, periodiseret uden moms', 6250.0, 0.0
  UNION ALL SELECT '7440', 'Skyldigt revisorhonorar 2024', 0.0, 6250.0
  UNION ALL SELECT '6305', 'Udskudt skatteaktiv jf. årsrapport', 1375.0, 0.0
  UNION ALL SELECT '3760', 'Skatteindtægt ved regulering af udskudt skat', 0.0, 1375.0
) AS adjustment
JOIN `accounts` AS account
  ON account.`id` = (
    SELECT MIN(candidate.`id`) FROM `accounts` AS candidate
    WHERE candidate.`company_id` = company.`id`
      AND candidate.`account_number` = adjustment.`account_number`
  )
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (
    SELECT 1 FROM `journal_lines` AS line WHERE line.`journal_entry_id` = entry.`id`
  );
--> statement-breakpoint

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT company.`id`, NULL, 'system@addsmartregnskab.dk',
       'year_end_reconciliation_posted', 'journal_entries',
       CASE
         WHEN REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
           THEN '{"year":2024,"entryNumber":"AFSLUT-2024-001","debit":65217,"credit":65217,"source":"Filed annual report and customer confirmation of auditor fee"}'
         ELSE '{"year":2024,"entryNumber":"AFSLUT-2024-001","debit":47625,"credit":47625,"source":"Filed annual report"}'
       END,
       CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') IN ('44822539', '44818566')
  AND EXISTS (
    SELECT 1 FROM `journal_entries` AS entry
    WHERE entry.`company_id` = company.`id` AND entry.`entry_number` = 'AFSLUT-2024-001'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `audit_logs` AS log
    WHERE log.`company_id` = company.`id`
      AND log.`action` = 'year_end_reconciliation_posted'
      AND log.`detail` LIKE '%"entryNumber":"AFSLUT-2024-001"%'
  );
