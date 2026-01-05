import { Hono } from 'hono'
import { eq, and, desc, count, like, or, isNull, inArray, isNotNull } from 'drizzle-orm'
import { getDb } from './db/db'
import { users, vouchers } from './db/schema'
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

// Helper to generate 16-digit uppercase string
const generateVoucherCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
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
    recentVouchers
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
      customerName: users.name,
    })
    .from(vouchers)
    .leftJoin(users, eq(vouchers.bindedToPhoneNumber, users.phoneNumber))
    .where(isNull(vouchers.deletedAt))
    .orderBy(desc(vouchers.createdAt))
    .limit(5)
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

  return c.json({
    vouchers: voucherStats,
    customers: {
      total: totalCustomers[0].value,
    },
    recentActivity: recentVouchers
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
  const offset = (page - 1) * limit

  let whereClause = isNull(users.deletedAt)
  if (role) {
    whereClause = and(whereClause, eq(users.role, role)) as any
  } else if (user.role === 'cashier') {
    // Cashiers can only see customers by default if no role specified
    whereClause = and(whereClause, eq(users.role, 'customer')) as any
  }

  const data = await db.select({
    id: users.id,
    name: users.name,
    phoneNumber: users.phoneNumber,
    dateOfBirth: users.dateOfBirth,
    role: users.role,
    username: users.username
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
  const newVoucher = await db.insert(vouchers).values({
    code: generateVoucherCode(),
    status: 'available',
    name: body.name,
    imageUrl: body.imageUrl,
    description: body.description,
  }).returning()
  return c.json(newVoucher[0])
})

app.post('/vouchers/batch', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const body = await c.req.json()
  const { count: batchCount, name, imageUrl, description } = body

  if (!batchCount || batchCount <= 0) {
    return c.json({ error: 'Invalid count' }, 400)
  }

  const newVouchers = []
  for (let i = 0; i < batchCount; i++) {
    newVouchers.push({
      code: generateVoucherCode(),
      status: 'available' as 'available' | 'active' | 'claimed',
      name,
      imageUrl,
      description,
    })
  }

  // SQLite has a limit on variables in a single query, so we might need to chunk this if batchCount is very large.
  // For 100 vouchers, it should be fine.
  const result = await db.insert(vouchers).values(newVouchers).returning()
  return c.json(result)
})

app.post('/vouchers/upload', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const body = await c.req.parseBody()
  const file = body['file'] as File
  if (!file) return c.json({ error: 'No file uploaded' }, 400)

  const fileName = `${Date.now()}-${file.name}`
  await c.env.BUCKET.put(fileName, file)

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
  
  // Ensure Content-Type is set for social media crawlers
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
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '10')
  const status = c.req.query('status')
  const requested = c.req.query('requested') === 'true'
  const offset = (page - 1) * limit

  const conditions = [isNull(vouchers.deletedAt)]
  if (status) {
    const statusList = status.split(',')
    conditions.push(inArray(vouchers.status, statusList as any))
  } else if (requested) {
    conditions.push(eq(vouchers.status, 'active'))
    conditions.push(isNotNull(vouchers.claimRequestedAt))
    conditions.push(isNull(vouchers.usedAt))
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
    .orderBy(desc(vouchers.createdAt))

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

  return c.json({ success: true, count: results.length, data: results })
})

app.post('/vouchers/claim', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const db = getDb(c.env.DB)
  const { code } = await c.req.json()
  
  const updatedVoucher = await db.update(vouchers)
    .set({ 
      status: 'claimed',
      approvedAt: new Date(),
      approvedBy: user.username,
      usedAt: new Date(),
      claimRequestedAt: null
    })
    .where(eq(vouchers.code, code))
    .returning()
    
  return c.json(updatedVoucher)
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

  return c.json(updatedVoucher[0])
})

app.get('/customer/vouchers', authMiddleware, async (c) => {
  const user = c.get('user')
  const db = getDb(c.env.DB)
  const phoneNumber = normalizePhone(c.req.query('phoneNumber'))

  // Customers can only see their own vouchers
  if (user.role === 'customer' && user.username !== phoneNumber && user.phoneNumber !== phoneNumber) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Admin/Cashier can see any customer's vouchers if they provide a phoneNumber
  const targetPhone = user.role === 'customer' ? (user.phoneNumber || user.username) : phoneNumber

  if (!targetPhone) {
    return c.json({ error: 'Phone number is required' }, 400)
  }

  const customerVouchers = await db.select().from(vouchers).where(and(eq(vouchers.bindedToPhoneNumber, targetPhone), isNull(vouchers.deletedAt)))
  return c.json(customerVouchers)
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

  return c.json({ success: true })
})

app.delete('/vouchers/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const id = c.req.param('id')
  const db = getDb(c.env.DB)

  await db.update(vouchers)
    .set({ deletedAt: new Date() })
    .where(eq(vouchers.id, id))

  return c.json({ success: true })
})

export default app
