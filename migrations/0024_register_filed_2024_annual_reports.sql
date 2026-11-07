-- Register the two customer-approved, publicly filed 2024 annual reports.
-- These rows are authoritative filing snapshots. They deliberately do not
-- rewrite imported journal entries; the application keeps the difference as
-- a visible reconciliation item and preserves the original audit trail.

INSERT INTO `annual_reports` (
  `company_id`, `year`, `result`, `tax_result`, `balance_total`, `equity`,
  `xbrl_status`, `auditor_package`, `status`,
  `submitted_to_erhvervsstyrelsen`, `created_at`
)
SELECT
  company.`id`, 2024, -134428, 37662, 183252, -94428,
  'indsendt',
  '{"periodStart":"2024-05-10","periodEnd":"2024-12-31","publishedAt":"2025-08-01","grossProfit":-127377,"operatingResult":-171711,"resultBeforeTax":-172090,"taxBenefit":37662,"liabilitiesTotal":277680,"sourceLabel":"Erhvervsstyrelsens register over offentliggjorte årsrapporter","sourceUrl":"https://regnskaber.virk.dk/93522844/amNsb3VkczovLzAzL2E4L2U3LzYyL2RlLzQzYmItNDVkYS1iNjg2LWEwOTljMTdkYTNhNQ.pdf"}',
  'indsendt', 1, '2025-08-01T00:00:00.000Z'
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
  AND NOT EXISTS (
    SELECT 1 FROM `annual_reports` AS report
    WHERE report.`company_id` = company.`id` AND report.`year` = 2024
  );
--> statement-breakpoint
UPDATE `annual_reports`
SET
  `result` = -134428,
  `tax_result` = 37662,
  `balance_total` = 183252,
  `equity` = -94428,
  `xbrl_status` = 'indsendt',
  `auditor_package` = '{"periodStart":"2024-05-10","periodEnd":"2024-12-31","publishedAt":"2025-08-01","grossProfit":-127377,"operatingResult":-171711,"resultBeforeTax":-172090,"taxBenefit":37662,"liabilitiesTotal":277680,"sourceLabel":"Erhvervsstyrelsens register over offentliggjorte årsrapporter","sourceUrl":"https://regnskaber.virk.dk/93522844/amNsb3VkczovLzAzL2E4L2U3LzYyL2RlLzQzYmItNDVkYS1iNjg2LWEwOTljMTdkYTNhNQ.pdf"}',
  `status` = 'indsendt',
  `submitted_to_erhvervsstyrelsen` = 1
WHERE `year` = 2024
  AND `company_id` IN (
    SELECT `id` FROM `companies`
    WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44822539'
  );
--> statement-breakpoint
INSERT INTO `annual_reports` (
  `company_id`, `year`, `result`, `tax_result`, `balance_total`, `equity`,
  `xbrl_status`, `auditor_package`, `status`,
  `submitted_to_erhvervsstyrelsen`, `created_at`
)
SELECT
  company.`id`, 2024, -4875, 1375, 41375, 35125,
  'indsendt',
  '{"periodStart":"2024-05-06","periodEnd":"2024-12-31","publishedAt":"2025-08-01","grossProfit":-6250,"operatingResult":-6250,"resultBeforeTax":-6250,"taxBenefit":1375,"liabilitiesTotal":6250,"sourceLabel":"Erhvervsstyrelsens register over offentliggjorte årsrapporter","sourceUrl":"https://regnskaber.virk.dk/66581844/amNsb3VkczovLzAzL2FiLzY3L2MyLzJhL2Q0N2EtNDliMy04ZjAxLTkzN2MwYTQxY2JlNg.pdf"}',
  'indsendt', 1, '2025-08-01T00:00:00.000Z'
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44818566'
  AND NOT EXISTS (
    SELECT 1 FROM `annual_reports` AS report
    WHERE report.`company_id` = company.`id` AND report.`year` = 2024
  );
--> statement-breakpoint
UPDATE `annual_reports`
SET
  `result` = -4875,
  `tax_result` = 1375,
  `balance_total` = 41375,
  `equity` = 35125,
  `xbrl_status` = 'indsendt',
  `auditor_package` = '{"periodStart":"2024-05-06","periodEnd":"2024-12-31","publishedAt":"2025-08-01","grossProfit":-6250,"operatingResult":-6250,"resultBeforeTax":-6250,"taxBenefit":1375,"liabilitiesTotal":6250,"sourceLabel":"Erhvervsstyrelsens register over offentliggjorte årsrapporter","sourceUrl":"https://regnskaber.virk.dk/66581844/amNsb3VkczovLzAzL2FiLzY3L2MyLzJhL2Q0N2EtNDliMy04ZjAxLTkzN2MwYTQxY2JlNg.pdf"}',
  `status` = 'indsendt',
  `submitted_to_erhvervsstyrelsen` = 1
WHERE `year` = 2024
  AND `company_id` IN (
    SELECT `id` FROM `companies`
    WHERE REPLACE(COALESCE(`cvr`, ''), ' ', '') = '44818566'
  );
--> statement-breakpoint
INSERT INTO `audit_logs` (`company_id`, `user_id`, `user_email`, `action`, `target`, `detail`, `created_at`)
SELECT
  company.`id`, NULL, 'system@addsmartregnskab.dk',
  'filed_annual_report_registered', 'annual_reports',
  CASE
    WHEN REPLACE(COALESCE(company.`cvr`, ''), ' ', '') = '44822539'
      THEN '{"year":2024,"result":-134428,"source":"Erhvervsstyrelsen","reason":"Customer-approved registration of the publicly filed annual report; imported journal entries remain unchanged."}'
    ELSE '{"year":2024,"result":-4875,"source":"Erhvervsstyrelsen","reason":"Customer-approved registration of the publicly filed annual report; imported journal entries remain unchanged."}'
  END,
  CURRENT_TIMESTAMP
FROM `companies` AS company
WHERE REPLACE(COALESCE(company.`cvr`, ''), ' ', '') IN ('44822539', '44818566');
