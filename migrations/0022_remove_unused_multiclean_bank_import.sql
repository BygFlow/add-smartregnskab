-- Customer-confirmed deletion on 2026-11-06.
-- The freshly imported 2024 file for account reference 13424713 belongs to an
-- old MultiClean account and must not be used in the current bookkeeping.
-- Account reference 13800707 (ADD Multi Service ApS) is deliberately retained.

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT
  service.`id`,
  NULL,
  'system@addsmartregnskab.dk',
  'bank_import_deleted',
  'bank_transactions',
  '{"accountRef":"13424713","period":"2024-07-22/2024-11-21","reason":"Customer confirmed the old MultiClean account must not be used in the current bookkeeping.","scope":"fresh import from 2026-11-06"}',
  CURRENT_TIMESTAMP
FROM `companies` AS service
WHERE (
  REPLACE(COALESCE(service.`cvr`, ''), ' ', '') = '44822539'
  OR LOWER(REPLACE(REPLACE(TRIM(service.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
)
AND EXISTS (
  SELECT 1
  FROM `bank_transactions` AS tx
  WHERE tx.`company_id` IN (
    SELECT company.`id`
    FROM `companies` AS company
    WHERE LOWER(REPLACE(REPLACE(TRIM(company.`name`), ' ', ''), '.', '')) = 'addsmartdriftaps'
       OR REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
       OR LOWER(REPLACE(REPLACE(TRIM(company.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
       OR LOWER(REPLACE(REPLACE(TRIM(company.`name`), ' ', ''), '.', '')) LIKE 'addmulticleanservice%'
       OR company.`id` IN (
         SELECT unit.`accounting_company_id`
         FROM `company_units` AS unit
         WHERE REPLACE(REPLACE(COALESCE(unit.`se_number`, ''), ' ', ''), '-', '') = '45147592'
           AND unit.`accounting_company_id` IS NOT NULL
       )
  )
    AND tx.`provider` = 'danske-bank'
    AND tx.`account_ref` = '13424713'
    AND tx.`date` BETWEEN '2024-07-22' AND '2024-11-21'
    AND tx.`imported_at` >= '2026-11-06'
)
LIMIT 1;
--> statement-breakpoint
DELETE FROM `bank_transactions`
WHERE `company_id` IN (
  SELECT company.`id`
  FROM `companies` AS company
  WHERE LOWER(REPLACE(REPLACE(TRIM(company.`name`), ' ', ''), '.', '')) = 'addsmartdriftaps'
     OR REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
     OR LOWER(REPLACE(REPLACE(TRIM(company.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
     OR LOWER(REPLACE(REPLACE(TRIM(company.`name`), ' ', ''), '.', '')) LIKE 'addmulticleanservice%'
     OR company.`id` IN (
       SELECT unit.`accounting_company_id`
       FROM `company_units` AS unit
       WHERE REPLACE(REPLACE(COALESCE(unit.`se_number`, ''), ' ', ''), '-', '') = '45147592'
         AND unit.`accounting_company_id` IS NOT NULL
     )
)
AND `provider` = 'danske-bank'
AND `account_ref` = '13424713'
AND `date` BETWEEN '2024-07-22' AND '2024-11-21'
AND `imported_at` >= '2026-11-06';
