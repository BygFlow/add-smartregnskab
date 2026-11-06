-- One-time, tenant-scoped correction approved by the customer on 2026-11-06.
-- Two historical Danske Bank CSV files were imported while ADD SmartDrift ApS
-- was selected. Move only those freshly imported 2024 rows to ADD Multi Service
-- ApS. Older rows, other accounts and other periods are deliberately excluded.

INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT
  target.`id`,
  NULL,
  'system@addsmartregnskab.dk',
  'bank_import_company_correction',
  'bank_transactions',
  '{"source":"ADD SmartDrift ApS","target":"ADD Multi Service ApS","reason":"Two customer-approved 2024 Danske Bank CSV imports were made under the wrong company profile."}',
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
    AND tx.`account_ref` IN ('13424713', '13800707')
    AND tx.`date` BETWEEN '2024-07-22' AND '2024-12-31'
    AND tx.`imported_at` >= '2026-11-06'
)
LIMIT 1;
--> statement-breakpoint
DELETE FROM `bank_transactions`
WHERE `company_id` IN (
  SELECT `id`
  FROM `companies`
  WHERE LOWER(REPLACE(REPLACE(TRIM(`name`), ' ', ''), '.', '')) = 'addsmartdriftaps'
)
AND `provider` = 'danske-bank'
AND `account_ref` IN ('13424713', '13800707')
AND `date` BETWEEN '2024-07-22' AND '2024-12-31'
AND `imported_at` >= '2026-11-06'
AND `external_id` IS NOT NULL
AND EXISTS (
  SELECT 1
  FROM `bank_transactions` AS existing
  WHERE existing.`company_id` = (
    SELECT target.`id`
    FROM `companies` AS target
    WHERE REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539'
       OR LOWER(REPLACE(REPLACE(TRIM(target.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
    ORDER BY CASE WHEN REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539' THEN 0 ELSE 1 END
    LIMIT 1
  )
  AND existing.`external_id` = `bank_transactions`.`external_id`
);
--> statement-breakpoint
UPDATE `bank_transactions`
SET `company_id` = (
  SELECT target.`id`
  FROM `companies` AS target
  WHERE REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539'
     OR LOWER(REPLACE(REPLACE(TRIM(target.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
  ORDER BY CASE WHEN REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539' THEN 0 ELSE 1 END
  LIMIT 1
)
WHERE `company_id` IN (
  SELECT `id`
  FROM `companies`
  WHERE LOWER(REPLACE(REPLACE(TRIM(`name`), ' ', ''), '.', '')) = 'addsmartdriftaps'
)
AND `provider` = 'danske-bank'
AND `account_ref` IN ('13424713', '13800707')
AND `date` BETWEEN '2024-07-22' AND '2024-12-31'
AND `imported_at` >= '2026-11-06'
AND EXISTS (
  SELECT 1
  FROM `companies` AS target
  WHERE REPLACE(COALESCE(target.`cvr`, ''), ' ', '') = '44822539'
     OR LOWER(REPLACE(REPLACE(TRIM(target.`name`), ' ', ''), '.', '')) = 'addmultiserviceaps'
);
