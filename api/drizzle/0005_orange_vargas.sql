PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`binded_to_phone_number` text,
	`created_at` integer NOT NULL,
	`expiry_date` integer,
	`approved_at` integer,
	`approved_by` text,
	`used_at` integer,
	`claim_requested_at` integer,
	`image_url` text,
	`description` text,
	`deleted_at` integer,
	FOREIGN KEY (`binded_to_phone_number`) REFERENCES `users`(`phone_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`username`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_vouchers`("id", "code", "status", "binded_to_phone_number", "created_at", "expiry_date", "approved_at", "approved_by", "used_at", "claim_requested_at", "image_url", "description", "deleted_at") SELECT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))), "code", "status", "binded_to_phone_number", "created_at", "expiry_date", "approved_at", "approved_by", "used_at", "claim_requested_at", "image_url", "description", "deleted_at" FROM `vouchers`;--> statement-breakpoint
DROP TABLE `vouchers`;--> statement-breakpoint
ALTER TABLE `__new_vouchers` RENAME TO `vouchers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `vouchers_code_unique` ON `vouchers` (`code`);