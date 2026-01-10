import { Hono } from 'hono'
import { getDb } from '../db/db'
import { vouchers } from '../db/schema'
import { eq, and, isNull, desc, count, sql, asc } from 'drizzle-orm'
import { logAudit } from '../lib/audit'
import { normalizePhone } from '../lib/helpers'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

router.get('/vouchers', async (c) => {
  const user = c.get('user')
  const db = getDb(c.env.DB)
  const phoneNumber = normalizePhone(c.req.query('phoneNumber'))
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '4')
  const offset = (page - 1) * limit

  if (user.role === 'customer' && user.username !== phoneNumber && user.phoneNumber !== phoneNumber) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const targetPhone = user.role === 'customer' ? (user.phoneNumber || user.username) : phoneNumber
  if (!targetPhone) return c.json({ error: 'Phone number is required' }, 400)

  const conditions = and(eq(vouchers.bindedToPhoneNumber, targetPhone as string), isNull(vouchers.deletedAt))
  const now = Date.now()
  const [data, total] = await Promise.all([
    db.select().from(vouchers).where(conditions).orderBy(
      asc(sql`CASE WHEN ${vouchers.status} = 'active' AND (${vouchers.expiryDate} IS NULL OR (${vouchers.expiryDate} + 86400000) > ${now}) THEN 1 WHEN ${vouchers.status} = 'claimed' THEN 2 ELSE 3 END`),
      desc(vouchers.expiryDate)
    ).limit(limit).offset(offset),
    db.select({ value: count() }).from(vouchers).where(conditions)
  ])

  return c.json({ data, total: total[0].value, page, limit, totalPages: Math.ceil(total[0].value / limit) })
})

router.get('/vouchers/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const v = await db.select().from(vouchers).where(eq(vouchers.id, id)).get()
  if (!v || v.deletedAt) return c.json({ error: 'Not found' }, 404)
  const userPhone = user.phoneNumber || user.username
  if (user.role === 'customer' && v.bindedToPhoneNumber !== userPhone) return c.json({ error: 'Forbidden' }, 403)
  return c.json(v)
})

router.post('/vouchers/:id/request-claim', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const v = await db.select().from(vouchers).where(eq(vouchers.id, id)).get()
  if (!v) return c.json({ error: 'Not found' }, 404)
  const userPhone = user.phoneNumber || user.username
  if (user.role === 'customer' && v.bindedToPhoneNumber !== userPhone) return c.json({ error: 'Forbidden' }, 403)
  if (v.status !== 'active') return c.json({ error: 'Only active vouchers' }, 400)
  const uv = await db.update(vouchers).set({ claimRequestedAt: new Date() }).where(eq(vouchers.id, id)).returning()
  logAudit(db, 'VOUCHER_CLAIM_REQUEST', `User ${userPhone} requested claim for ${v.code}`, c)
  return c.json(uv[0])
})

export default router
