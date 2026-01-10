import { Hono } from 'hono'
import { getDb } from '../db/db'
import { templates } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

router.get('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB)
    const res = await db.select().from(templates).orderBy(desc(templates.createdAt))
    return c.json(res)
})

router.post('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB); const body = await c.req.json()
    const res = await db.insert(templates).values({ name: body.name, description: body.description, imageUrl: body.imageUrl }).returning()
    return c.json(res[0])
})

router.delete('/:id', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB); const id = parseInt(c.req.param('id'))
    await db.delete(templates).where(eq(templates.id, id))
    return c.json({ success: true })
})

export default router
