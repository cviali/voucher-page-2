import { jwtVerify } from 'jose'
import { Bindings } from '../types'

export const getJwtSecret = (env: Bindings) => new TextEncoder().encode(env.JWT_SECRET || 'your-secret-key')

export const authMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)

    try {
        const token = authHeader.split(' ')[1]
        const secret = getJwtSecret(c.env)
        const { payload } = await jwtVerify(token, secret)
        c.set('user', payload)
        await next()
    } catch (e) {
        return c.json({ error: 'Invalid token' }, 401)
    }
}
