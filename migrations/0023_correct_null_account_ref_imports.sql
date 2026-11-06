-- Follow-up correction approved by the customer on 2026-11-06.
-- The Danske Bank CSV importer left account_ref NULL, so the two imports are
-- identified by their exact import seconds and non-overlapping date ranges.
-- 273 rows from 17:19:52-53 belong to the unused old MultiClean account.
-- 43 rows from 17:20:13 belong to ADD Multi Service account 13800707.

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT
  target.`id`,
  NULL,
  'system@addsmartregnskab.dk',
  'bank_import_company_correction',
  'bank_transactions',
  '{"accountRef":"13800707","rows":43,"period":"2024-12-02/2024-12-31","reason":"The CSV importer stored a null account reference; the exact import second identifies the customer-approved Multi Service file."}',
  CURRENT_TIMESTAMP
FROM `companies` AS target
WHERE (
  REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539'
  OR LOWER(REPLACE(REPLACE(TRIM(target.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
)
AND EXISTS (
  SELECT 1
  FROM `bank_transactions` AS tx
  JOIN `companies` AS source ON source.`id` = tx.`company_id`
  WHERE LOWER(REPLACE(REPLACE(TRIM(source.`name`), ' ', ''), '.', '')) = 'addsmartdriftaps'
    AND tx.`provider` = 'danske-bank'
    AND tx.`account_ref` IS NULL
    AND tx.`external_id` LIKE 'danske-bank||%'
    AND tx.`date` BETWEEN '2024-12-02' AND '2024-12-31'
    AND tx.`imported_at` >= '2026-11-06T17:20:13.000Z'
    AND tx.`imported_at` < '2026-11-06T17:20:14.000Z'
)
LIMIT 1;
--> statement-breakpoint
UPDATE `bank_transactions`
SET
  `company_id` = (
    SELECT target.`id`
    FROM `companies` AS target
    WHERE REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539'
       OR LOWER(REPLACE(REPLACE(TRIM(target.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
    ORDER BY CASE WHEN REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539' THEN 0 ELSE 1 END
    LIMIT 1
  ),
  `account_ref` = '13800707'
WHERE `company_id` IN (
  SELECT `id`
  FROM `companies`
  WHERE LOWER(REPLACE(REPLACE(TRIM(`name`), ' ', ''), '.', '')) = 'addsmartdriftaps'
)
AND `provider` = 'danske-bank'
AND `account_ref` IS NULL
AND `external_id` LIKE 'danske-bank||%'
AND `date` BETWEEN '2024-12-02' AND '2024-12-31'
AND `imported_at` >= '2026-11-06T17:20:13.000Z'
AND `imported_at` < '2026-11-06T17:20:14.000Z'
AND EXISTS (
  SELECT 1
  FROM `companies` AS target
  WHERE REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539'
     OR LOWER(REPLACE(REPLACE(TRIM(target.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
);
--> statement-breakpoint
INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT
  service.`id`,
  NULL,
  'system@addsmartregnskab.dk',
  'bank_import_deleted',
  'bank_transactions',
  '{"accountRef":"13424713","rows":273,"period":"2024-07-22/2024-11-21","reason":"The CSV importer stored a null account reference; the exact import seconds identify the customer-rejected old MultiClean file."}',
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
  )
    AND tx.`provider` = 'danske-bank'
    AND tx.`account_ref` IS NULL
    AND tx.`external_id` LIKE 'danske-bank||%'
    AND tx.`date` BETWEEN '2024-07-22' AND '2024-11-21'
    AND tx.`imported_at` >= '2026-11-06T17:19:52.000Z'
    AND tx.`imported_at` < '2026-11-06T17:19:54.000Z'
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
)
AND `provider` = 'danske-bank'
AND `account_ref` IS NULL
AND `external_id` LIKE 'danske-bank||%'
AND `date` BETWEEN '2024-07-22' AND '2024-11-21'
AND `imported_at` >= '2026-11-06T17:19:52.000Z'
AND `imported_at` < '2026-11-06T17:19:54.000Z';
