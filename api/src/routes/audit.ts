import { Hono } from 'hono'
import { getDb } from '../db/db'
import { auditLogs } from '../db/schema'
import { desc, count } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

router.get('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
    const { limit = '50', offset = '0' } = c.req.query()
    const db = getDb(c.env.DB)
    const logs = await db.query.auditLogs.findMany({ orderBy: [desc(auditLogs.createdAt)], limit: parseInt(limit), offset: parseInt(offset) })
    const [total] = await db.select({ value: count() }).from(auditLogs)
    return c.json({ data: logs, total: total.value })
})

export default router
