import { auditLogs } from '../db/schema'

export const logAudit = (db: any, action: string, details: string, c: any, overrideUser?: any) => {
    const user = overrideUser || c.get('user')
    const logPromise = db.insert(auditLogs).values({
        action,
        details,
        userId: user?.id,
        username: user?.username || user?.phoneNumber || 'system',
        ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
    }).run()

    c.executionCtx.waitUntil(logPromise)
}
