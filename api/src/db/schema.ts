import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').unique(), // for admin/cashier
  password: text('password'), // hashed password
  name: text('name'), // display name
  phoneNumber: text('phone_number').unique(), // for customer, stored without country code
  dateOfBirth: text('date_of_birth'), // YYYY-MM-DD, for customer
  role: text('role', { enum: ['admin', 'cashier', 'customer'] }).notNull().default('customer'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export const vouchers = sqliteTable('vouchers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(), // 16-digit uppercase string
  status: text('status', { enum: ['available', 'active', 'claimed'] }).notNull().default('available'),
  bindedToPhoneNumber: text('binded_to_phone_number').references(() => users.phoneNumber),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiryDate: integer('expiry_date', { mode: 'timestamp' }),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  approvedBy: text('approved_by').references(() => users.username),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  claimRequestedAt: integer('claim_requested_at', { mode: 'timestamp' }),
  imageUrl: text('image_url'),
  description: text('description'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
