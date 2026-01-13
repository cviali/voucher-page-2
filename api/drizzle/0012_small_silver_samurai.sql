CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_phone_number` text NOT NULL,
	`processed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	`revocation_reason` text,
	`is_reward_generated` integer DEFAULT false,
	`reward_voucher_id` text,
	FOREIGN KEY (`customer_phone_number`) REFERENCES `users`(`phone_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`username`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by`) REFERENCES `users`(`username`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reward_voucher_id`) REFERENCES `vouchers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visit_customer_phone_idx` ON `visits` (`customer_phone_number`);