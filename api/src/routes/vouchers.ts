import { Hono } from 'hono'
import { and, eq, isNull, or, like, desc, count, inArray, isNotNull, sql, asc, lt, gt } from 'drizzle-orm'
import { getDb } from '../db/db'
import { users, vouchers, templates, redemptions } from '../db/schema'
import { logAudit } from '../lib/audit'
import { normalizePhone, generateVoucherCode } from '../lib/helpers'
import { authMiddleware } from '../middleware/auth'
import { Bindings, Variables } from '../types'

const voucherRoutes = new Hono<{ Bindings: Bindings, Variables: Variables }>()

// Public routes (no auth)
voucherRoutes.get('/image/:name', async (c) => {
    const name = c.req.param('name')
    const object = await c.env.BUCKET.get(name)
    if (!object) return c.json({ error: 'Not found' }, 404)

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Content-Length', object.size.toString())

    if (!headers.has('Content-Type')) {
        if (name.endsWith('.png')) headers.set('Content-Type', 'image/png')
        else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) headers.set('Content-Type', 'image/jpeg')
        else if (name.endsWith('.webp')) headers.set('Content-Type', 'image/webp')
        else if (name.endsWith('.svg')) headers.set('Content-Type', 'image/svg+xml')
    }

    return new Response(object.body, { headers })
})

voucherRoutes.get('/public/:id', async (c) => {
    const id = c.req.param('id')
    const db = getDb(c.env.DB)
    const voucher = await db.select({
        name: vouchers.name,
        imageUrl: vouchers.imageUrl,
    }).from(vouchers).where(and(eq(vouchers.id, id), isNull(vouchers.deletedAt))).get()

    if (!voucher) return c.json({ error: 'Not found' }, 404)
    return c.json(voucher)
})

// Protected routes
voucherRoutes.use('*', authMiddleware)

voucherRoutes.get('/', async (c) => {
    try {
        const user = c.get('user')
        if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

        const db = getDb(c.env.DB)
        const page = parseInt(c.req.query('page') || '1')
        const limit = parseInt(c.req.query('limit') || '10')
        const status = c.req.query('status')
        const search = c.req.query('search')
        const requested = c.req.query('requested') === 'true'
        const offset = (page - 1) * limit
        const now = new Date()

        const conditions = [isNull(vouchers.deletedAt)]
        if (status && status !== 'all') {
            if (status === 'expired') {
                conditions.push(and(
                    eq(vouchers.status, 'active'),
                    isNotNull(vouchers.expiryDate),
                    lt(vouchers.expiryDate, now)
                ) as any)
            } else if (status === 'active') {
                conditions.push(and(
                    eq(vouchers.status, 'active'),
                    or(isNull(vouchers.expiryDate), gt(vouchers.expiryDate, now))
                ) as any)
            } else {
                const statusList = status.split(',')
                conditions.push(inArray(vouchers.status, statusList as any))
            }
        } else if (requested) {
            conditions.push(eq(vouchers.status, 'active'))
            conditions.push(isNotNull(vouchers.claimRequestedAt))
            conditions.push(isNull(vouchers.usedAt))
        }

        if (search) {
            conditions.push(or(
                like(vouchers.code, `%${search}%`),
                like(vouchers.name, `%${search}%`)
            ) as any)
        }

        const data = await db.select({
            id: vouchers.id,
            code: vouchers.code,
            name: vouchers.name,
            status: vouchers.status,
            createdAt: vouchers.createdAt,
            expiryDate: vouchers.expiryDate,
            imageUrl: vouchers.imageUrl,
            description: vouchers.description,
            bindedToPhoneNumber: vouchers.bindedToPhoneNumber,
            approvedBy: vouchers.approvedBy,
            approvedAt: vouchers.approvedAt,
            usedAt: vouchers.usedAt,
            claimRequestedAt: vouchers.claimRequestedAt,
            customerName: users.name,
        })
            .from(vouchers)
            .leftJoin(users, eq(vouchers.bindedToPhoneNumber, users.phoneNumber))
            .where(and(...conditions))
            .limit(limit)
            .offset(offset)
            .orderBy(
                asc(sql`CASE 
          WHEN ${vouchers.status} = 'active' AND (${vouchers.expiryDate} IS NULL OR ${vouchers.expiryDate} > ${now.getTime()}) THEN 1
          WHEN ${vouchers.status} = 'available' THEN 2
          WHEN ${vouchers.status} = 'claimed' THEN 3
          WHEN ${vouchers.status} = 'active' AND ${vouchers.expiryDate} <= ${now.getTime()} THEN 4
          ELSE 5
        END`),
                desc(vouchers.createdAt)
            )

        const totalResult = await db.select({ value: count() }).from(vouchers).where(and(...conditions))
        const total = totalResult[0].value

        return c.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (err: any) {
        return c.json({ error: err.message || 'Internal Server Error' }, 500)
    }
})

voucherRoutes.post('/', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const body = await c.req.json()

    let templateId = body.templateId
    if (!templateId && body.name) {
        const newTemplate = await db.insert(templates).values({
            name: body.name,
            imageUrl: body.imageUrl,
            description: body.description,
        }).returning()
        templateId = newTemplate[0].id
    }

    const newVoucher = await db.insert(vouchers).values({
        code: await generateVoucherCode(db),
        status: 'available',
        templateId,
        name: body.name,
        imageUrl: body.imageUrl,
        description: body.description,
    }).returning()

    logAudit(db, 'VOUCHER_CREATE', `Created voucher ${newVoucher[0].code}`, c)
    return c.json(newVoucher[0])
})

voucherRoutes.post('/batch', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const body = await c.req.json()
    const { count: batchCount, name, imageUrl, description, templateId: existingTemplateId } = body

    if (!batchCount || batchCount <= 0) return c.json({ error: 'Invalid count' }, 400)

    let templateId = existingTemplateId
    if (!templateId && name) {
        const newTemplate = await db.insert(templates).values({ name, imageUrl, description }).returning()
        templateId = newTemplate[0].id
    }

    const activeCodes = await db.select({ code: vouchers.code })
        .from(vouchers)
        .where(or(eq(vouchers.status, 'available'), eq(vouchers.status, 'active')))
    const codeSet = new Set(activeCodes.map((v: any) => v.code))
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

    const toInsert = []
    for (let i = 0; i < batchCount; i++) {
        let code = ''
        let attempts = 0
        while (attempts < 50) {
            code = ''
            for (let j = 0; j < 4; j++) code += chars.charAt(Math.floor(Math.random() * chars.length))
            if (!codeSet.has(code)) break
            attempts++
        }
        codeSet.add(code)
        toInsert.push({ code, status: 'available' as any, templateId, name, imageUrl, description })
    }

    const result = await db.insert(vouchers).values(toInsert).returning()
    logAudit(db, 'VOUCHER_BATCH_CREATE', `Created ${batchCount} vouchers in batch`, c)
    return c.json(result)
})

voucherRoutes.post('/upload', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const body = await c.req.parseBody()
    const file = body['file'] as File
    if (!file) return c.json({ error: 'No file uploaded' }, 400)

    const fileName = `${Date.now()}-${file.name}`
    await c.env.BUCKET.put(fileName, file, {
        httpMetadata: { contentType: file.type || 'image/jpeg' }
    })

    return c.json({ url: `/vouchers/image/${fileName}` })
})

voucherRoutes.patch('/:id', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const id = c.req.param('id')
    const body = await c.req.json()
    const db = getDb(c.env.DB)

    const updatedVoucher = await db.update(vouchers)
        .set({
            name: body.name,
            description: body.description,
            imageUrl: body.imageUrl,
            status: body.status,
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
        })
        .where(eq(vouchers.id, id))
        .returning()

    return c.json(updatedVoucher[0])
})

voucherRoutes.post('/bind', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const { code, phoneNumber, expiryDays, expiryDate: customExpiryDate } = await c.req.json()

    let expiryDate = new Date()
    if (customExpiryDate) expiryDate = new Date(customExpiryDate)
    else expiryDate.setDate(expiryDate.getDate() + (expiryDays || 30))

    const updatedVoucher = await db.update(vouchers)
        .set({
            bindedToPhoneNumber: normalizePhone(phoneNumber),
            status: 'active' as any,
            approvedAt: new Date(),
            expiryDate: expiryDate
        })
        .where(eq(vouchers.code, code))
        .returning()

    if (updatedVoucher.length > 0) {
        logAudit(db, 'VOUCHER_BIND', `Bound voucher ${code} to ${phoneNumber}`, c)
    }
    return c.json(updatedVoucher[0])
})

voucherRoutes.post('/bulk-bind', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const { voucherName, phoneNumbers, expiryDays, expiryDate: customExpiryDate } = await c.req.json()

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return c.json({ error: 'No phone numbers provided' }, 400)
    }

    let expiryDate = new Date()
    if (customExpiryDate) expiryDate = new Date(customExpiryDate)
    else expiryDate.setDate(expiryDate.getDate() + (expiryDays || 30))

    const availableVouchers = await db.select().from(vouchers).where(and(
        eq(vouchers.status, 'available'),
        eq(vouchers.name, voucherName),
        isNull(vouchers.deletedAt)
    )).limit(phoneNumbers.length)

    if (availableVouchers.length < phoneNumbers.length) {
        return c.json({ error: `Not enough available vouchers. Found ${availableVouchers.length}, need ${phoneNumbers.length}.` }, 400)
    }

    const results = []
    for (let i = 0; i < phoneNumbers.length; i++) {
        const voucher = availableVouchers[i]
        const phoneNumber = normalizePhone(phoneNumbers[i])
        const updated = await db.update(vouchers).set({
            bindedToPhoneNumber: phoneNumber,
            status: 'active' as any,
            approvedAt: new Date(),
            expiryDate: expiryDate
        }).where(eq(vouchers.id, voucher.id)).returning()
        results.push(updated[0])
    }

    logAudit(db, 'VOUCHER_BULK_BIND', `Bulk bound ${results.length} vouchers for ${voucherName}`, c)
    return c.json({ success: true, count: results.length, data: results })
})

voucherRoutes.post('/claim', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const db = getDb(c.env.DB)
    const { code, spentAmount } = await c.req.json()

    const voucher = await db.select().from(vouchers).where(eq(vouchers.code, code)).get()
    if (!voucher) return c.json({ error: 'Voucher not found' }, 404)
    if (voucher.status === 'claimed') return c.json({ error: 'Voucher already claimed' }, 400)

    const finalSpentAmount = Math.max(0, spentAmount || 0)

    const batchQueries: any[] = [
        db.update(vouchers)
            .set({
                status: 'claimed',
                approvedBy: user.username,
                usedAt: new Date(),
                claimRequestedAt: null,
                spentAmount: finalSpentAmount
            })
            .where(eq(vouchers.code, code))
            .returning()
    ]

    if (voucher.bindedToPhoneNumber) {
        batchQueries.push(
            db.insert(redemptions).values({
                voucherId: voucher.id,
                customerPhoneNumber: voucher.bindedToPhoneNumber,
                amount: finalSpentAmount,
                processedBy: user.username,
            }),
            db.update(users)
                .set({ totalSpending: sql`COALESCE(${users.totalSpending}, 0) + ${finalSpentAmount}` })
                .where(eq(users.phoneNumber, voucher.bindedToPhoneNumber))
        )
    }

    const batchResults = await db.batch(batchQueries as any)
    const updatedVoucher = batchResults[0] as any[]

    logAudit(db, 'VOUCHER_CLAIM', `Claimed voucher ${code} for customer ${voucher.bindedToPhoneNumber || 'unknown'}. Amount: ${finalSpentAmount}`, c)
    return c.json(updatedVoucher[0])
})

voucherRoutes.delete('/:id', async (c) => {
    const user = c.get('user')
    if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

    const id = c.req.param('id')
    const db = getDb(c.env.DB)

    const voucher = await db.select().from(vouchers).where(eq(vouchers.id, id)).get()
    if (voucher) {
        await db.update(vouchers).set({ deletedAt: new Date() }).where(eq(vouchers.id, id))
        logAudit(db, 'VOUCHER_DELETE', `Deleted voucher ${voucher.code}`, c)
    }
    return c.json({ success: true })
})

export default voucherRoutes
