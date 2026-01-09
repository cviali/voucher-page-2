CREATE TABLE `redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`voucher_id` text NOT NULL,
	`customer_phone_number` text NOT NULL,
	`amount` integer NOT NULL,
	`processed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_phone_number`) REFERENCES `users`(`phone_number`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`username`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `vouchers` ADD `template_id` integer REFERENCES templates(id);