-- Reparer ældre aktiveringer, hvor abonnementstillægget blev gemt uden at
-- åbne AI-adgangen på den tilknyttede abonnementsvirksomhed.
UPDATE `companies`
SET `ai_enabled` = 1
WHERE `id` IN (
  SELECT `company_id`
  FROM `subscriptions`
  WHERE `ai_addon_enabled` = 1
);
