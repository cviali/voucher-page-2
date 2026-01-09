import { Hono } from 'hono'
import { eq, and, desc, count, like, or, isNull, inArray, isNotNull, sql, asc, lt, gt } from 'drizzle-orm'
import { getDb } from './db/db'
import { users, vouchers, templates, redemptions, auditLogs } from './db/schema'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  BUCKET: R2Bucket
}

type Variables = {
  user: {
    id: number
    username: string
    phoneNumber?: string
    role: 'admin' | 'cashier' | 'customer'
    name: string
  }
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

const SECRET = new TextEncoder().encode('your-secret-key') // In production, use c.env.JWT_SECRET

// Middleware to verify JWT
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const token = authHeader.split(' ')[1]
    const { payload } = await jwtVerify(token, SECRET)
    c.set('user', payload)
    await next()
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

// Helper to log audit actions
const logAudit = (db: any, action: string, details: string, c: any, overrideUser?: any) => {
  const user = overrideUser || c.get('user')
  const logPromise = db.insert(auditLogs).values({
    action,
    details,
    userId: user?.id,
    username: user?.username || user?.phoneNumber || 'system',
    ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
  }).run()

  // This tells Cloudflare to finish the write even after the response is sent to the user
  c.executionCtx.waitUntil(logPromise)
}

// Helper to generate 4-digit alphanumeric code (numbers and uppercase letters)
const generateVoucherCode = async (db: any) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed confusing O, 0, I, 1
  
  // Get all active/available codes to ensure uniqueness
  const existingCodes = await db.select({ code: vouchers.code })
    .from(vouchers)
    .where(or(eq(vouchers.status, 'available'), eq(vouchers.status, 'active')))
  
  const codeSet = new Set(existingCodes.map((v: any) => v.code))

  let result = ''
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    result = ''
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    if (!codeSet.has(result)) return result
    attempts++
  }
  
  // If we can't find a 4-digit code (rare), fallback to a longer one to avoid failure
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Helper to normalize phone number (remove leading 0)
const normalizePhone = (phone: string | null | undefined) => {
  if (!phone) return phone
  return phone.startsWith('0') ? phone.substring(1) : phone
}

app.post('/auth/login', async (c) => {
  const db = getDb(c.env.DB)
  const { username, password } = await c.req.json()

  const user = await db.query.users.findFirst({
    where: and(
      eq(users.username, username),
      or(eq(users.role, 'admin'), eq(users.role, 'cashier')),
      isNull(users.deletedAt)
    )
  })

  if (!user || !user.password) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await new SignJWT({ id: user.id, username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET)

  logAudit(db, 'USER_LOGIN', `Staff user ${user.username} logged in`, c, user)

  return c.json({ token, user: { username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber } })
})

app.post('/auth/customer/login', async (c) => {
  const db = getDb(c.env.DB)
  const { phoneNumber, dateOfBirth } = await c.req.json()
  const normalizedPhone = normalizePhone(phoneNumber)

  if (!normalizedPhone) {
    return c.json({ error: 'Phone number is required' }, 400)
  }

  const user = await db.query.users.findFirst({
    where: and(
      eq(users.phoneNumber, normalizedPhone),
      eq(users.role, 'customer'),
      isNull(users.deletedAt)
    )
  })

  // For customers, we check if their DOB matches
  if (!user || user.dateOfBirth !== dateOfBirth) {
    return c.json({ error: 'Invalid phone number or date of birth' }, 401)
  }

  const token = await new SignJWT({ id: user.id, username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(SECRET)

  logAudit(db, 'USER_LOGIN', `Customer logged in: ${user.phoneNumber}`, c, user)

  return c.json({ token, user: { username: user.username, role: user.role, name: user.name, phoneNumber: user.phoneNumber } })
})

app.get('/auth/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({ user })
})

app.get('/stats', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)

  const [
    voucherCounts,
    totalCustomers,
    recentVouchers,
    bindHistory,
    claimHistory
  ] = await Promise.all([
    db.select({ 
      status: vouchers.status, 
      count: count() 
    }).from(vouchers).where(isNull(vouchers.deletedAt)).groupBy(vouchers.status),
    db.select({ value: count() }).from(users).where(and(eq(users.role, 'customer'), isNull(users.deletedAt))),
    db.select({
      id: vouchers.id,
      code: vouchers.code,
      name: vouchers.name,
      status: vouchers.status,
      createdAt: vouchers.createdAt,
      expiryDate: vouchers.expiryDate,
      claimRequestedAt: vouchers.claimRequestedAt,
      customerName: users.name,
    })
    .from(vouchers)
    .leftJoin(users, eq(vouchers.bindedToPhoneNumber, users.phoneNumber))
    .where(isNull(vouchers.deletedAt))
    .orderBy(desc(vouchers.createdAt))
    .limit(5),
    db.select({
      date: sql<string>`strftime('%Y-%m-%d', datetime(${vouchers.createdAt}/1000, 'unixepoch'))`,
      count: count()
    })
    .from(vouchers)
    .where(and(
      isNull(vouchers.deletedAt), 
      sql`${vouchers.createdAt} >= ${Date.now() - 90 * 24 * 60 * 60 * 1000}`
    ))
    .groupBy(sql`1`),
    db.select({
      date: sql<string>`strftime('%Y-%m-%d', datetime(${vouchers.usedAt}/1000, 'unixepoch'))`,
      count: count()
    })
    .from(vouchers)
    .where(and(
      isNull(vouchers.deletedAt),
      isNotNull(vouchers.usedAt),
      sql`${vouchers.usedAt} >= ${Date.now() - 90 * 24 * 60 * 60 * 1000}`
    ))
    .groupBy(sql`1`)
  ])

  const voucherStats = {
    total: 0,
    available: 0,
    active: 0,
    claimed: 0
  }

  voucherCounts.forEach(vc => {
    if (vc.status === 'available') voucherStats.available = vc.count
    if (vc.status === 'active') voucherStats.active = vc.count
    if (vc.status === 'claimed') voucherStats.claimed = vc.count
    voucherStats.total += vc.count
  })

  // Merge history into a single array for the chart
  const historyMap = new Map<string, { date: string, binds: number, claims: number }>()
  
  // Initialize last 90 days
  for (let i = 89; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    historyMap.set(dateStr, { date: dateStr, binds: 0, claims: 0 })
  }

  bindHistory.forEach(bh => {
    if (historyMap.has(bh.date)) {
      historyMap.get(bh.date)!.binds = bh.count
    }
  })

  claimHistory.forEach(ch => {
    if (historyMap.has(ch.date)) {
      historyMap.get(ch.date)!.claims = ch.count
    }
  })

  return c.json({
    vouchers: voucherStats,
    customers: {
      total: totalCustomers[0].value,
    },
    recentActivity: recentVouchers,
    chartData: Array.from(historyMap.values())
  })
})

app.get('/users/search', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const q = normalizePhone(c.req.query('q') || '') as string
  
  if (q.length < 2) return c.json([])

  const results = await db.select({
    id: users.id,
    name: users.name,
    phoneNumber: users.phoneNumber,
    username: users.username
  })
  .from(users)
  .where(
    and(
      eq(users.role, 'customer'),
      isNull(users.deletedAt),
      or(
        like(users.phoneNumber, `%${q}%`),
        like(users.name, `%${q}%`)
      )
    )
  )
  .limit(10)

  return c.json(results)
})

app.get('/users', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '10')
  const role = c.req.query('role') as 'admin' | 'cashier' | 'customer' | undefined
  const search = c.req.query('search')
  const offset = (page - 1) * limit

  let whereClause = isNull(users.deletedAt)
  if (role) {
    whereClause = and(whereClause, eq(users.role, role)) as any
  } else if (user.role === 'cashier') {
    // Cashiers can only see customers by default if no role specified
    whereClause = and(whereClause, eq(users.role, 'customer')) as any
  }

  if (search) {
    whereClause = and(whereClause, or(
      like(users.phoneNumber, `%${search}%`),
      like(users.name, `%${search}%`),
      like(users.username, `%${search}%`)
    )) as any
  }

  const data = await db.select({
    id: users.id,
    name: users.name,
    phoneNumber: users.phoneNumber,
    dateOfBirth: users.dateOfBirth,
    role: users.role,
    username: users.username,
    totalSpending: users.totalSpending
  })
  .from(users)
  // @ts-ignore
  .where(whereClause)
  .limit(limit)
  .offset(offset)
  .orderBy(desc(users.id))

  // @ts-ignore
  const totalResult = await db.select({ value: count() }).from(users).where(whereClause)
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
})

app.post('/users', authMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const targetRole = body.role || 'customer'

  // Only admin can create admin/cashier. Cashier can only create customer.
  if (user.role === 'cashier' && targetRole !== 'customer') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  if (user.role !== 'admin' && user.role !== 'cashier') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const db = getDb(c.env.DB)
  
  const normalizedPhone = normalizePhone(body.phoneNumber)
  // For customers, username is their phone number if not provided
  const username = targetRole === 'customer' ? (body.username || normalizedPhone) : body.username
  // For customers, password is their DOB if not provided (simple default)
  const password = targetRole === 'customer' ? (body.password || body.dateOfBirth?.replace(/-/g, '')) : body.password
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    const newUser = await db.insert(users).values({
      username,
      password: hashedPassword,
      name: body.name,
      phoneNumber: normalizedPhone,
      dateOfBirth: body.dateOfBirth,
      role: targetRole,
    }).returning()

    logAudit(db, 'USER_CREATE', `Created ${targetRole} user: ${username || normalizedPhone}`, c)

    return c.json(newUser[0])
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'User with this phone number or username already exists' }, 400)
    }
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

app.post('/vouchers', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const body = await c.req.json()
  
  // Handle template creation or lookup
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

app.post('/vouchers/batch', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const body = await c.req.json()
  const { count: batchCount, name, imageUrl, description, templateId: existingTemplateId } = body

  if (!batchCount || batchCount <= 0) {
    return c.json({ error: 'Invalid count' }, 400)
  }

  // Handle template
  let templateId = existingTemplateId
  if (!templateId && name) {
    const newTemplate = await db.insert(templates).values({
      name,
      imageUrl,
      description,
    }).returning()
    templateId = newTemplate[0].id
  }

  // Refactor: Get all active codes once
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
    toInsert.push({
      code,
      status: 'available' as 'available' | 'active' | 'claimed',
      templateId,
      name,
      imageUrl,
      description,
    })
  }

  const result = await db.insert(vouchers).values(toInsert).returning()
  logAudit(db, 'VOUCHER_BATCH_CREATE', `Created ${batchCount} vouchers in batch`, c)

  return c.json(result)
})

app.post('/vouchers/upload', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.parseBody()
  const file = body['file'] as File
  if (!file) return c.json({ error: 'No file uploaded' }, 400)

  const fileName = `${Date.now()}-${file.name}`
  await c.env.BUCKET.put(fileName, file, {
    httpMetadata: {
      contentType: file.type || 'image/jpeg',
    }
  })

  // In a real app, you'd use a custom domain or a public URL
  // For Cloudflare Workers, you can use a proxy endpoint or R2.dev URL
  const url = `/api/vouchers/image/${fileName}`
  return c.json({ url })
})

app.get('/vouchers/image/:name', async (c) => {
  const name = c.req.param('name')

  const object = await c.env.BUCKET.get(name)
  if (!object) return c.json({ error: 'Not found' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  // Cache images at the edge and browser for 1 year
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

app.get('/vouchers/public/:id', async (c) => {
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const voucher = await db.select({
    name: vouchers.name,
    imageUrl: vouchers.imageUrl,
  }).from(vouchers).where(and(eq(vouchers.id, id), isNull(vouchers.deletedAt))).get()

  if (!voucher) return c.json({ error: 'Not found' }, 404)
  return c.json(voucher)
})

app.patch('/vouchers/:id', authMiddleware, async (c) => {
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
      status: body.status as 'available' | 'active' | 'claimed',
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    })
    .where(eq(vouchers.id, id))
    .returning()

  return c.json(updatedVoucher[0])
})

app.get('/vouchers', authMiddleware, async (c) => {
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

    const query = db.select({
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

    const countQuery = db.select({ value: count() }).from(vouchers).where(and(...conditions))

    const data = await query
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

    const totalResult = await countQuery
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
    console.error('Error fetching vouchers:', err)
    return c.json({ error: err.message || 'Internal Server Error' }, 500)
  }
})

app.post('/vouchers/bind', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const { code, phoneNumber, expiryDays, expiryDate: customExpiryDate } = await c.req.json()
  
  let expiryDate = new Date()
  if (customExpiryDate) {
    expiryDate = new Date(customExpiryDate)
  } else {
    expiryDate.setDate(expiryDate.getDate() + (expiryDays || 30))
  }

  const updatedVoucher = await db.update(vouchers)
    .set({ 
      bindedToPhoneNumber: normalizePhone(phoneNumber),
      status: 'active' as 'available' | 'active' | 'claimed',
      expiryDate: expiryDate
    })
    .where(eq(vouchers.code, code))
    .returning()
    
  if (updatedVoucher.length > 0) {
    logAudit(db, 'VOUCHER_BIND', `Bound voucher ${code} to ${phoneNumber}`, c)
  }
    
  return c.json(updatedVoucher[0])
})

app.post('/vouchers/bulk-bind', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const { voucherName, phoneNumbers, expiryDays, expiryDate: customExpiryDate } = await c.req.json()

  if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return c.json({ error: 'No phone numbers provided' }, 400)
  }

  let expiryDate = new Date()
  if (customExpiryDate) {
    expiryDate = new Date(customExpiryDate)
  } else {
    expiryDate.setDate(expiryDate.getDate() + (expiryDays || 30))
  }

  // Find available vouchers with the same name
  const availableVouchers = await db.select()
    .from(vouchers)
    .where(and(
      eq(vouchers.status, 'available'),
      eq(vouchers.name, voucherName),
      isNull(vouchers.deletedAt)
    ))
    .limit(phoneNumbers.length)

  if (availableVouchers.length < phoneNumbers.length) {
    return c.json({ error: `Not enough available vouchers. Found ${availableVouchers.length}, need ${phoneNumbers.length}.` }, 400)
  }

  const results = []
  for (let i = 0; i < phoneNumbers.length; i++) {
    const voucher = availableVouchers[i]
    const phoneNumber = normalizePhone(phoneNumbers[i])
    
    const updated = await db.update(vouchers)
      .set({
        bindedToPhoneNumber: phoneNumber,
        status: 'active' as 'available' | 'active' | 'claimed',
        expiryDate: expiryDate
      })
      .where(eq(vouchers.id, voucher.id))
      .returning()
    
    results.push(updated[0])
  }

  logAudit(db, 'VOUCHER_BULK_BIND', `Bulk bound ${results.length} vouchers for ${voucherName}`, c)

  return c.json({ success: true, count: results.length, data: results })
})

app.post('/vouchers/claim', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const { code, spentAmount } = await c.req.json()
  
  // Find voucher first to get the binded customer
  const voucher = await db.select().from(vouchers).where(eq(vouchers.code, code)).get()
  if (!voucher) return c.json({ error: 'Voucher not found' }, 404)
  if (voucher.status === 'claimed') return c.json({ error: 'Voucher already claimed' }, 400)

  const finalSpentAmount = Math.max(0, spentAmount || 0)

  // Use D1 Batching for better performance and to ensure atomicity
  const batchQueries: any[] = [
    db.update(vouchers)
      .set({ 
        status: 'claimed',
        approvedAt: new Date(),
        approvedBy: user.username,
        usedAt: new Date(),
        claimRequestedAt: null,
        spentAmount: finalSpentAmount
      })
      .where(eq(vouchers.code, code))
      .returning()
  ]

  // Add ledger and user spending updates to the same batch
  if (voucher.bindedToPhoneNumber) {
    batchQueries.push(
      db.insert(redemptions).values({
        voucherId: voucher.id,
        customerPhoneNumber: voucher.bindedToPhoneNumber,
        amount: finalSpentAmount,
        processedBy: user.username,
      })
    )

    batchQueries.push(
      db.update(users)
        .set({
          totalSpending: sql`COALESCE(${users.totalSpending}, 0) + ${finalSpentAmount}`
        })
        .where(eq(users.phoneNumber, voucher.bindedToPhoneNumber))
    )
  }

  const batchResults = await db.batch(batchQueries as any)
  const updatedVoucher = batchResults[0] as any[]

  logAudit(db, 'VOUCHER_CLAIM', `Claimed voucher ${code} for customer ${voucher.bindedToPhoneNumber || 'unknown'}. Amount: ${finalSpentAmount}`, c)
    
  return c.json(updatedVoucher[0])
})

app.post('/customer/vouchers/:id/request-claim', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = getDb(c.env.DB)

  const voucher = await db.select().from(vouchers).where(eq(vouchers.id, id)).get()
  if (!voucher) return c.json({ error: 'Voucher not found' }, 404)

  // Check ownership
  const userPhone = user.phoneNumber || user.username
  if (user.role === 'customer' && voucher.bindedToPhoneNumber !== userPhone) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  if (voucher.status !== 'active') {
    return c.json({ error: 'Only active vouchers can be claimed' }, 400)
  }

  const updatedVoucher = await db.update(vouchers)
    .set({ claimRequestedAt: new Date() })
    .where(eq(vouchers.id, id))
    .returning()

  logAudit(db, 'VOUCHER_CLAIM_REQUEST', `User ${userPhone} requested claim for voucher ${voucher.code}`, c)

  return c.json(updatedVoucher[0])
})

app.get('/customer/vouchers', authMiddleware, async (c) => {
  const user = c.get('user')
  const db = getDb(c.env.DB)
  const phoneNumber = normalizePhone(c.req.query('phoneNumber'))
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '4')
  const offset = (page - 1) * limit

  // Customers can only see their own vouchers
  if (user.role === 'customer' && user.username !== phoneNumber && user.phoneNumber !== phoneNumber) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Admin/Cashier can see any customer's vouchers if they provide a phoneNumber
  const targetPhone = user.role === 'customer' ? (user.phoneNumber || user.username) : phoneNumber

  if (!targetPhone) {
    return c.json({ error: 'Phone number is required' }, 400)
  }

  const conditions = and(eq(vouchers.bindedToPhoneNumber, targetPhone), isNull(vouchers.deletedAt))

  const now = Date.now()
  const [customerVouchers, totalCount] = await Promise.all([
    db.select()
      .from(vouchers)
      .where(conditions)
      .orderBy(
        asc(sql`CASE 
          WHEN ${vouchers.status} = 'active' AND (${vouchers.expiryDate} IS NULL OR (${vouchers.expiryDate} + 86400) > ${Math.floor(now / 1000)}) THEN 1
          WHEN ${vouchers.status} = 'claimed' THEN 2
          ELSE 3
        END`),
        desc(vouchers.expiryDate)
      )
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(vouchers).where(conditions)
  ])

  return c.json({
    data: customerVouchers,
    total: totalCount[0].value,
    page,
    limit,
    totalPages: Math.ceil(totalCount[0].value / limit)
  })
})

app.get('/customer/vouchers/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = getDb(c.env.DB)

  const voucher = await db.select().from(vouchers).where(eq(vouchers.id, id)).get()
  
  if (!voucher || voucher.deletedAt) {
    return c.json({ error: 'Voucher not found' }, 404)
  }

  // Check ownership: customers can only see their own vouchers
  const userPhone = user.phoneNumber || user.username
  if (user.role === 'customer' && voucher.bindedToPhoneNumber !== userPhone) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return c.json(voucher)
})

// Template Management
app.get('/templates', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const results = await db.select().from(templates).orderBy(desc(templates.createdAt))
  return c.json(results)
})

app.post('/templates', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const body = await c.req.json()

  const result = await db.insert(templates).values({
    name: body.name,
    description: body.description,
    imageUrl: body.imageUrl,
  }).returning()

  return c.json(result[0])
})

app.delete('/templates/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const id = parseInt(c.req.param('id'))

  await db.delete(templates).where(eq(templates.id, id))
  return c.json({ success: true })
})

app.patch('/users/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const db = getDb(c.env.DB)

  try {
    // Check if target user exists and get their role
    const targetUser = await db.select().from(users).where(eq(users.id, id)).get()
    if (!targetUser) return c.json({ error: 'User not found' }, 404)

    // Only admin can edit admin/cashier. Cashier can only edit customer.
    if (user.role === 'cashier' && targetUser.role !== 'customer') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    if (user.role !== 'admin' && user.role !== 'cashier') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.username !== undefined) updateData.username = body.username
    if (body.phoneNumber !== undefined) updateData.phoneNumber = normalizePhone(body.phoneNumber)
    if (body.dateOfBirth !== undefined) updateData.dateOfBirth = body.dateOfBirth
    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 10)
    }
    if (body.role && user.role === 'admin') updateData.role = body.role

    const oldPhone = targetUser.phoneNumber
    const newPhone = updateData.phoneNumber

    if (newPhone && oldPhone && newPhone !== oldPhone) {
      // Get IDs of vouchers bound to old phone to update them safely
      const vouchersToUpdate = await db.select({ id: vouchers.id })
        .from(vouchers)
        .where(eq(vouchers.bindedToPhoneNumber, oldPhone))
      
      const voucherIds = vouchersToUpdate.map(v => v.id)

      if (voucherIds.length > 0) {
        // Use a transaction (batch) to update both user and their vouchers
        // We set to null first to avoid FK constraint issues during the update
        await db.batch([
          db.update(vouchers)
            .set({ bindedToPhoneNumber: null })
            .where(inArray(vouchers.id, voucherIds)),
          db.update(users)
            .set(updateData)
            .where(eq(users.id, id)),
          db.update(vouchers)
            .set({ bindedToPhoneNumber: newPhone })
            .where(inArray(vouchers.id, voucherIds))
        ])
      } else {
        await db.update(users)
          .set(updateData)
          .where(eq(users.id, id))
      }
      
      // Fetch the updated user to return it
      const updatedUser = await db.select().from(users).where(eq(users.id, id)).get()
      return c.json(updatedUser)
    } else {
      const updatedUser = await db.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning()

      if (updatedUser.length === 0) {
        return c.json({ error: 'Failed to update user' }, 500)
      }

      return c.json(updatedUser[0])
    }
  } catch (err: any) {
    console.error('Update user error:', err)
    if (err.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'User with this phone number or username already exists' }, 400)
    }
    return c.json({ error: err.message || 'Failed to update user' }, 500)
  }
})

app.delete('/users/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  // Check if target user exists and get their role
  const targetUser = await db.select().from(users).where(eq(users.id, id)).get()
  if (!targetUser) return c.json({ error: 'User not found' }, 404)

  // Only admin can delete admin/cashier. Cashier can only delete customer.
  if (user.role === 'cashier' && targetUser.role !== 'customer') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  if (user.role !== 'admin' && user.role !== 'cashier') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await db.update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, id))

  logAudit(db, 'USER_DELETE', `Deleted user ${targetUser.username || targetUser.phoneNumber}`, c)

  return c.json({ success: true })
})

app.delete('/vouchers/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const id = c.req.param('id')
  const db = getDb(c.env.DB)

  const voucher = await db.select().from(vouchers).where(eq(vouchers.id, id)).get()
  if (voucher) {
    await db.update(vouchers)
      .set({ deletedAt: new Date() })
      .where(eq(vouchers.id, id))

    logAudit(db, 'VOUCHER_DELETE', `Deleted voucher ${voucher.code}`, c)
  }

  return c.json({ success: true })
})

app.get('/audit-logs', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const { limit = '50', offset = '0' } = c.req.query()
  const db = getDb(c.env.DB)

  const logs = await db.query.auditLogs.findMany({
    orderBy: [desc(auditLogs.createdAt)],
    limit: parseInt(limit),
    offset: parseInt(offset),
  })

  // Get total count for pagination
  const [totalCount] = await db.select({ value: count() }).from(auditLogs)

  return c.json({
    data: logs,
    total: totalCount.value,
  })
})

export default app
