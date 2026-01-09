ALTER TABLE `users` ADD `total_spending` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vouchers` ADD `spent_amount` integer DEFAULT 0;