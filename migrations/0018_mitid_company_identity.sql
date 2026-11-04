CREATE TABLE `company_identity_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`provider` text DEFAULT 'idura' NOT NULL,
	`environment` text DEFAULT 'test' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expected_cvr` text NOT NULL,
	`verified_cvr` text,
	`subject_hash` text,
	`identity_uuid_hash` text,
	`actor_role` text,
	`assurance_level` text,
	`initiated_by` integer NOT NULL,
	`started_at` text NOT NULL,
	`verified_at` text,
	`failed_at` text,
	`failure_reason` text,
	`evidence` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `company_identity_verification_company_created_idx` ON `company_identity_verifications` (`company_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `mitid_oidc_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`state_hash` text NOT NULL,
	`company_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`verification_id` integer NOT NULL,
	`expected_cvr` text NOT NULL,
	`code_verifier_encrypted` text NOT NULL,
	`nonce_encrypted` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mitid_oidc_states_state_hash_unique` ON `mitid_oidc_states` (`state_hash`);
