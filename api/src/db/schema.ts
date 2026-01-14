import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').unique(), // for admin/cashier
  password: text('password'), // hashed password
  name: text('name'), // display name
  phoneNumber: text('phone_number').unique(), // for customer, stored without country code
  dateOfBirth: text('date_of_birth'), // YYYY-MM-DD, for customer
  role: text('role', { enum: ['admin', 'cashier', 'customer'] }).notNull().default('customer'),
  totalSpending: integer('total_spending').default(0), // cumulative spending in cents or smallest unit
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const vouchers = sqliteTable('vouchers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(), // 16-digit uppercase string
  templateId: integer('template_id').references(() => templates.id), // Link to template
  status: text('status', { enum: ['available', 'active', 'claimed'] }).notNull().default('available'),
  bindedToPhoneNumber: text('binded_to_phone_number').references(() => users.phoneNumber),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiryDate: integer('expiry_date', { mode: 'timestamp' }),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  approvedBy: text('approved_by').references(() => users.username),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  claimRequestedAt: integer('claim_requested_at', { mode: 'timestamp' }),
  spentAmount: integer('spent_amount').default(0), // amount spent in this transaction
  name: text('name'),
  imageUrl: text('image_url'),
  description: text('description'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => ({
  phoneNumberIdx: index('phone_number_idx').on(table.bindedToPhoneNumber),
  statusIdx: index('status_idx').on(table.status),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
  templateIdIdx: index('template_id_idx').on(table.templateId),
}));

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const redemptions = sqliteTable('redemptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  voucherId: text('voucher_id').notNull().references(() => vouchers.id),
  customerPhoneNumber: text('customer_phone_number').notNull().references(() => users.phoneNumber),
  amount: integer('amount').notNull(),
  processedBy: text('processed_by').notNull().references(() => users.username),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  voucherIdIdx: index('redemption_voucher_idx').on(table.voucherId),
  customerPhoneIdx: index('redemption_customer_phone_idx').on(table.customerPhoneNumber),
}));

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull(), // e.g., 'VOUCHER_BATCH_CREATE', 'USER_LOGIN', 'VOUCHER_CLAIM'
  details: text('details'), // JSON string or text details
  userId: integer('user_id').references(() => users.id),
  username: text('username'), // Denormalized for quick viewing
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index('audit_user_idx').on(table.userId),
  createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
}));

export const visits = sqliteTable('visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerPhoneNumber: text('customer_phone_number').notNull().references(() => users.phoneNumber),
  processedBy: text('processed_by').notNull().references(() => users.username),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),

  // Revocation logic
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  revokedBy: text('revoked_by').references(() => users.username),
  revocationReason: text('revocation_reason'),

  // Reward tracking
  isRewardGenerated: integer('is_reward_generated', { mode: 'boolean' }).default(false),
  rewardVoucherId: text('reward_voucher_id').references(() => vouchers.id),
}, (table) => ({
  customerPhoneIdx: index('visit_customer_phone_idx').on(table.customerPhoneNumber),
}));
