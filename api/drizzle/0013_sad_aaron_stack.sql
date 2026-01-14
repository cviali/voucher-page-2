CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `redemption_voucher_idx` ON `redemptions` (`voucher_id`);--> statement-breakpoint
CREATE INDEX `redemption_customer_phone_idx` ON `redemptions` (`customer_phone_number`);--> statement-breakpoint
CREATE INDEX `template_id_idx` ON `vouchers` (`template_id`);