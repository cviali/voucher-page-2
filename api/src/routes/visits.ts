import { Hono } from 'hono'
import { and, eq, isNull, count, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/db'
import { users, visits, vouchers, templates } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import { normalizePhone, generateVoucherCode } from '../lib/helpers'
import { Bindings, Variables } from '../types'
import { logAudit } from '../lib/audit'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

// Get all visits (Admin/Cashier)
router.get('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const allVisits = await db.select()
        .from(visits)
        .orderBy(desc(visits.createdAt))
        .limit(100)

    return c.json(allVisits)
})

// Get visit progress for a customer
router.get('/customer/:phoneNumber', async (c) => {
    const phoneNumber = normalizePhone(c.req.param('phoneNumber'))
    if (!phoneNumber) return c.json({ error: 'Phone number required' }, 400)

    const db = getDb(c.env.DB)

    // Check if customer exists
    const customer = await db.select().from(users).where(and(eq(users.phoneNumber, phoneNumber), eq(users.role, 'customer'), isNull(users.deletedAt))).get()
    if (!customer) return c.json({ error: 'Customer not registered' }, 404)

    // Get active visits (not revoked, not rewarded)
    const activeVisits = await db.select()
        .from(visits)
        .where(and(
            eq(visits.customerPhoneNumber, phoneNumber),
            isNull(visits.revokedAt),
            eq(visits.isRewardGenerated, false)
        ))
        .orderBy(desc(visits.createdAt))

    // Get history (all visits)
    const history = await db.select({
        id: visits.id,
        customerPhoneNumber: visits.customerPhoneNumber,
        processedBy: visits.processedBy,
        createdAt: visits.createdAt,
        revokedAt: visits.revokedAt,
        revokedBy: visits.revokedBy,
        revocationReason: visits.revocationReason,
        isRewardGenerated: visits.isRewardGenerated,
        rewardVoucherId: visits.rewardVoucherId,
        rewardVoucherCode: vouchers.code
    })
        .from(visits)
        .leftJoin(vouchers, eq(visits.rewardVoucherId, vouchers.id))
        .where(eq(visits.customerPhoneNumber, phoneNumber))
        .orderBy(desc(visits.createdAt))
        .limit(50)

    return c.json({
        phoneNumber,
        customerName: customer.name,
        activeCount: activeVisits.length,
        history
    })
})

// Record a visit
router.post('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const { phoneNumber, rewardTemplateId } = await c.req.json()
    const normalizedPhone = normalizePhone(phoneNumber)
    if (!normalizedPhone) return c.json({ error: 'Phone number required' }, 400)

    const db = getDb(c.env.DB)

    // Check if customer exists
    const existingUser = await db.select().from(users).where(and(eq(users.phoneNumber, normalizedPhone), eq(users.role, 'customer'), isNull(users.deletedAt))).get()
    if (!existingUser) return c.json({ error: 'Customer not registered' }, 404)

    // Get current active visits
    const activeVisits = await db.select()
        .from(visits)
        .where(and(
            eq(visits.customerPhoneNumber, normalizedPhone),
            isNull(visits.revokedAt),
            eq(visits.isRewardGenerated, false)
        ))
        .orderBy(visits.createdAt)

    const nextCount = activeVisits.length + 1

    if (activeVisits.length >= 10) {
        return c.json({ error: 'Stamp card is full. Please issue the reward before recording more visits.' }, 400)
    }

    const [newVisit] = await db.insert(visits).values({
        customerPhoneNumber: normalizedPhone,
        processedBy: user.username,
        isRewardGenerated: false
    }).returning()

    logAudit(db, 'VISIT_RECORDED', `Visit recorded for ${normalizedPhone}. Progress: ${nextCount}/10`, c)

    return c.json({
        success: true,
        visit: newVisit,
        progress: nextCount
    })
})

// Issue reward for 10 visits
router.post('/issue-reward', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const { phoneNumber, rewardTemplateId, expiresAt } = await c.req.json()
    const normalizedPhone = normalizePhone(phoneNumber)
    if (!normalizedPhone) return c.json({ error: 'Phone number required' }, 400)

    const db = getDb(c.env.DB)

    // Get active visits
    const activeVisits = await db.select()
        .from(visits)
        .where(and(
            eq(visits.customerPhoneNumber, normalizedPhone),
            isNull(visits.revokedAt),
            eq(visits.isRewardGenerated, false)
        ))
        .orderBy(visits.createdAt)
        .limit(10)

    if (activeVisits.length < 10) {
        return c.json({ error: 'Customer needs 10 stamps to issue a reward.' }, 400)
    }

    // Trigger reward
    const template = rewardTemplateId
        ? await db.select().from(templates).where(eq(templates.id, rewardTemplateId)).get()
        : await db.select().from(templates).limit(1).get()

    if (!template) {
        return c.json({ error: 'Reward template not found.' }, 404)
    }

    const code = await generateVoucherCode(db)
    const [voucher] = await db.insert(vouchers).values({
        code,
        templateId: template.id,
        name: template.name,
        description: template.description,
        imageUrl: template.imageUrl,
        status: 'active',
        bindedToPhoneNumber: normalizedPhone,
        expiryDate: expiresAt ? new Date(expiresAt) : undefined
    }).returning()

    // Mark these 10 visits as rewarded
    const visitIdsToMark = activeVisits.map(v => v.id)
    for (const vid of visitIdsToMark) {
        await db.update(visits)
            .set({ isRewardGenerated: true, rewardVoucherId: voucher.id })
            .where(eq(visits.id, vid))
    }

    logAudit(db, 'REWARD_ISSUED', `Loyalty reward issued for ${normalizedPhone}. Voucher: ${voucher.code}`, c)

    return c.json({
        success: true,
        voucherId: voucher.id,
        voucherCode: voucher.code
    })
})

// Revoke a visit
router.patch('/:id/revoke', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

    const id = parseInt(c.req.param('id'))
    const { reason } = await c.req.json()

    const db = getDb(c.env.DB)
    const visit = await db.select().from(visits).where(eq(visits.id, id)).get()

    if (!visit) return c.json({ error: 'Visit not found' }, 404)
    if (visit.revokedAt) return c.json({ error: 'Visit already revoked' }, 400)
    if (visit.isRewardGenerated) return c.json({ error: 'Cannot revoke a visit that already generated a reward' }, 400)

    const [updated] = await db.update(visits).set({
        revokedAt: new Date(),
        revokedBy: user.username,
        revocationReason: reason
    }).where(eq(visits.id, id)).returning()

    logAudit(db, 'VISIT_REVOKED', `Visit ID ${id} revoked for ${visit.customerPhoneNumber}. Reason: ${reason}`, c)

    return c.json(updated)
})

export default router
