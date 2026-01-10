CREATE INDEX `phone_number_idx` ON `vouchers` (`binded_to_phone_number`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `vouchers` (`status`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `vouchers` (`created_at`);