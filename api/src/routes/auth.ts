import { Hono } from 'hono'
import { getDb } from '../db/db'
import { users } from '../db/schema'
import { eq, or, and, isNull } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { verifyPassword } from '../lib/crypto'
import { normalizePhone } from '../lib/helpers'
import { logAudit } from '../lib/audit'
import { getJwtSecret, authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const auth = new Hono<{ Bindings: Bindings, Variables: Variables }>()

auth.post('/login', async (c) => {
    const db = getDb(c.env.DB)
    const { username, password } = await c.req.json()

    const user = await db.query.users.findFirst({
        where: and(
            eq(users.username, username),
            or(eq(users.role, 'admin'), eq(users.role, 'cashier')),
            isNull(users.deletedAt)
        )
    })

    if (!user || !user.password) return c.json({ error: 'Invalid credentials' }, 401)

    const isPasswordValid = await verifyPassword(password, user.password)
    if (!isPasswordValid) return c.json({ error: 'Invalid credentials' }, 401)

    const secret = getJwtSecret(c.env)
    const token = await new SignJWT({ id: user.id, username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secret)

    logAudit(db, 'USER_LOGIN', `Staff user ${user.username} logged in`, c, user)
    return c.json({ token, user: { username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber } })
})

auth.post('/customer/login', async (c) => {
    const db = getDb(c.env.DB)
    const { phoneNumber, dateOfBirth } = await c.req.json()
    const normalizedPhone = normalizePhone(phoneNumber)

    if (!normalizedPhone) return c.json({ error: 'Phone number is required' }, 400)

    const user = await db.query.users.findFirst({
        where: and(
            eq(users.phoneNumber, normalizedPhone as string),
            eq(users.role, 'customer'),
            isNull(users.deletedAt)
        )
    })

    if (!user || user.dateOfBirth !== dateOfBirth) return c.json({ error: 'Invalid credentials' }, 401)

    const secret = getJwtSecret(c.env)
    const token = await new SignJWT({ id: user.id, username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secret)

    logAudit(db, 'USER_LOGIN', `Customer logged in: ${user.phoneNumber}`, c, user)
    return c.json({ token, user: { username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber } })
})

auth.get('/me', authMiddleware, (c) => c.json({ user: c.get('user') }))

export default auth
