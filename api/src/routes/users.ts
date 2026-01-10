import { Hono } from 'hono'
import { getDb } from '../db/db'
import { users, vouchers } from '../db/schema'
import { eq, or, and, isNull, like, desc, count, sql, inArray } from 'drizzle-orm'
import { hashPassword } from '../lib/crypto'
import { normalizePhone } from '../lib/helpers'
import { logAudit } from '../lib/audit'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const router = new Hono<{ Bindings: Bindings, Variables: Variables }>()

router.use('*', authMiddleware)

router.get('/search', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const q = normalizePhone(c.req.query('q') || '') as string
    if (q.length < 2) return c.json([])

    const results = await db.select({
        id: users.id, name: users.name, phoneNumber: users.phoneNumber, username: users.username
    }).from(users).where(and(eq(users.role, 'customer'), isNull(users.deletedAt), or(like(users.phoneNumber, `%${q}%`), like(users.name, `%${q}%`)))).limit(10)
    return c.json(results)
})

router.get('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const role = c.req.query('role') as any
    const search = c.req.query('search')
    const offset = (page - 1) * limit

    let conditions = [isNull(users.deletedAt)]
    if (role) conditions.push(eq(users.role, role))
    else if (user.role === 'cashier') conditions.push(eq(users.role, 'customer'))

    if (search) {
        const searchFilter = or(
            like(users.phoneNumber, `%${search}%`),
            like(users.name, `%${search}%`),
            like(users.username, `%${search}%`)
        )
        if (searchFilter) conditions.push(searchFilter)
    }

    const data = await db.select({
        id: users.id, name: users.name, phoneNumber: users.phoneNumber, dateOfBirth: users.dateOfBirth, role: users.role, username: users.username, totalSpending: users.totalSpending
    }).from(users).where(and(...conditions)).limit(limit).offset(offset).orderBy(desc(users.id))

    const totalResult = await db.select({ value: count() }).from(users).where(and(...conditions))
    return c.json({ data, pagination: { page, limit, total: totalResult[0].value, totalPages: Math.ceil(totalResult[0].value / limit) } })
})

router.post('/', async (c) => {
    const user = c.get('user')
    const body = await c.req.json()
    const targetRole = body.role || 'customer'

    if (user.role === 'cashier' && targetRole !== 'customer') return c.json({ error: 'Forbidden' }, 403)
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const normalizedPhone = normalizePhone(body.phoneNumber)
    const username = targetRole === 'customer' ? (body.username || normalizedPhone) : body.username
    const password = targetRole === 'customer' ? (body.password || body.dateOfBirth?.replace(/-/g, '')) : body.password
    const hashedPassword = await hashPassword(password)

    try {
        const newUser = await db.insert(users).values({ username, password: hashedPassword, name: body.name, phoneNumber: normalizedPhone, dateOfBirth: body.dateOfBirth, role: targetRole }).returning()
        logAudit(db, 'USER_CREATE', `Created ${targetRole} user: ${username || normalizedPhone}`, c)
        return c.json(newUser[0])
    } catch (err: any) {
        if (err.message?.includes('UNIQUE constraint failed')) return c.json({ error: 'User already exists' }, 400)
        return c.json({ error: 'Failed' }, 500)
    }
})

router.patch('/:id', async (c) => {
    const user = c.get('user')
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const db = getDb(c.env.DB)

    const targetUser = await db.select().from(users).where(eq(users.id, id)).get()
    if (!targetUser) return c.json({ error: 'Not found' }, 404)

    if (user.role === 'cashier' && targetUser.role !== 'customer') return c.json({ error: 'Forbidden' }, 403)
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.username !== undefined) updateData.username = body.username
    if (body.phoneNumber !== undefined) updateData.phoneNumber = normalizePhone(body.phoneNumber)
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth
    if (body.password) updateData.password = await hashPassword(body.password)
    if (body.role && user.role === 'admin') updateData.role = body.role

    const oldPhone = targetUser.phoneNumber
    const newPhone = updateData.phoneNumber

    if (newPhone && oldPhone && newPhone !== oldPhone) {
        const vouchersToUpdate = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.bindedToPhoneNumber, oldPhone))
        const vIds = vouchersToUpdate.map(v => v.id)
        if (vIds.length > 0) {
            await db.batch([
                db.update(vouchers).set({ bindedToPhoneNumber: null }).where(inArray(vouchers.id, vIds)),
                db.update(users).set(updateData).where(eq(users.id, id)),
                db.update(vouchers).set({ bindedToPhoneNumber: newPhone }).where(inArray(vouchers.id, vIds))
            ])
        } else await db.update(users).set(updateData).where(eq(users.id, id))
        const updated = await db.select().from(users).where(eq(users.id, id)).get()
        return c.json(updated)
    } else {
        const updated = await db.update(users).set(updateData).where(eq(users.id, id)).returning()
        return c.json(updated[0])
    }
})

router.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = parseInt(c.req.param('id'))
    const db = getDb(c.env.DB)
    const targetUser = await db.select().from(users).where(eq(users.id, id)).get()
    if (!targetUser) return c.json({ error: 'Not found' }, 404)
    if (user.role === 'cashier' && targetUser.role !== 'customer') return c.json({ error: 'Forbidden' }, 403)
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id))
    logAudit(db, 'USER_DELETE', `Deleted user ${targetUser.username || targetUser.phoneNumber}`, c)
    return c.json({ success: true })
})

export default router
