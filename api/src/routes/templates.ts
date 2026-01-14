import { Hono } from 'hono'
import { getDb } from '../db/db'
import { templates } from '../db/schema'
import { eq, desc, like, and, count } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

router.get('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)
    
    const db = getDb(c.env.DB)
    const pageStr = c.req.query('page')
    const limitStr = c.req.query('limit')
    const search = c.req.query('search')

    if (!pageStr && !limitStr && !search) {
        const res = await db.select().from(templates).orderBy(desc(templates.createdAt))
        return c.json(res)
    }

    const page = parseInt(pageStr || '1')
    const limit = parseInt(limitStr || '30')
    const offset = (page - 1) * limit

    const conditions = []
    if (search) {
        conditions.push(like(templates.name, `%${search}%`))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, totalCount] = await Promise.all([
        db.select().from(templates)
            .where(whereClause)
            .orderBy(desc(templates.createdAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: count() }).from(templates)
            .where(whereClause)
    ])

    const total = totalCount[0].count
    const totalPages = Math.ceil(total / limit)

    return c.json({
        data,
        pagination: {
            total,
            totalPages,
            page,
            limit
        }
    })
})

router.post('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB); const body = await c.req.json()
    const res = await db.insert(templates).values({ name: body.name, description: body.description, imageUrl: body.imageUrl }).returning()
    return c.json(res[0])
})

router.delete('/:id', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB); const id = parseInt(c.req.param('id'))
    await db.delete(templates).where(eq(templates.id, id))
    return c.json({ success: true })
})

router.patch('/:id', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
    const db = getDb(c.env.DB)
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const res = await db.update(templates)
        .set({
            name: body.name,
            description: body.description,
            imageUrl: body.imageUrl
        })
        .where(eq(templates.id, id))
        .returning()
    return c.json(res[0])
})

export default router
