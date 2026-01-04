PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`phone_number` text,
	`date_of_birth` text,
	`role` text DEFAULT 'customer' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "phone_number", "date_of_birth", "role") SELECT "id", "username", "phone_number", "date_of_birth", "role" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_unique` ON `users` (`phone_number`);--> statement-breakpoint
ALTER TABLE `vouchers` ADD `expiry_date` integer;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `approved_by` text REFERENCES users(username);--> statement-breakpoint
ALTER TABLE `vouchers` ADD `used_at` integer;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `image_url` text;