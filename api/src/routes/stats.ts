import { Hono } from 'hono'
import { getDb } from '../db/db'
import { users, vouchers } from '../db/schema'
import { eq, and, desc, count, isNull, isNotNull, sql } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

router.get('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB)

    const [vCounts, tCust, rVouch, bHist, cHist] = await Promise.all([
        db.select({ status: vouchers.status, count: count() }).from(vouchers).where(isNull(vouchers.deletedAt)).groupBy(vouchers.status),
        db.select({ value: count() }).from(users).where(and(eq(users.role, 'customer'), isNull(users.deletedAt))),
        db.select({ id: vouchers.id, code: vouchers.code, name: vouchers.name, status: vouchers.status, createdAt: vouchers.createdAt, expiryDate: vouchers.expiryDate, claimRequestedAt: vouchers.claimRequestedAt, customerName: users.name })
            .from(vouchers).leftJoin(users, eq(vouchers.bindedToPhoneNumber, users.phoneNumber)).where(isNull(vouchers.deletedAt)).orderBy(desc(vouchers.createdAt)).limit(5),
        db.select({ date: sql<string>`strftime('%Y-%m-%d', datetime(${vouchers.approvedAt}/1000, 'unixepoch'))`, count: count() })
            .from(vouchers).where(and(isNull(vouchers.deletedAt), isNotNull(vouchers.approvedAt), sql`${vouchers.approvedAt} >= ${Date.now() - 90 * 24 * 60 * 60 * 1000}`))
            .groupBy(sql`strftime('%Y-%m-%d', datetime(${vouchers.approvedAt}/1000, 'unixepoch'))`),
        db.select({ date: sql<string>`strftime('%Y-%m-%d', datetime(${vouchers.usedAt}/1000, 'unixepoch'))`, count: count() })
            .from(vouchers).where(and(isNull(vouchers.deletedAt), isNotNull(vouchers.usedAt), sql`${vouchers.usedAt} >= ${Date.now() - 90 * 24 * 60 * 60 * 1000}`))
            .groupBy(sql`strftime('%Y-%m-%d', datetime(${vouchers.usedAt}/1000, 'unixepoch'))`)
    ])

    const vStats = { total: 0, available: 0, active: 0, claimed: 0 }
    vCounts.forEach(vc => {
        const n = Number(vc.count)
        if (vc.status === 'available') vStats.available = n
        else if (vc.status === 'active') vStats.active = n
        else if (vc.status === 'claimed') vStats.claimed = n
        vStats.total += n
    })

    const hMap = new Map<string, { date: string, binds: number, claims: number }>()
    for (let i = 89; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); const s = d.toISOString().split('T')[0]
        hMap.set(s, { date: s, binds: 0, claims: 0 })
    }
    bHist.forEach(bh => { if (hMap.has(bh.date)) hMap.get(bh.date)!.binds = Number(bh.count) })
    cHist.forEach(ch => { if (hMap.has(ch.date)) hMap.get(ch.date)!.claims = Number(ch.count) })

    return c.json({ vouchers: vStats, customers: { total: Number(tCust[0].value) }, recentActivity: rVouch, chartData: Array.from(hMap.values()) })
})

export default router
