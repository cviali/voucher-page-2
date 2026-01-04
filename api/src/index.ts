import { Hono } from 'hono'
import { eq, and, desc, count, like, or, isNull, inArray } from 'drizzle-orm'
import { getDb } from './db/db'
import { users, vouchers } from './db/schema'
import { SignJWT, jwtVerify } from 'jose'

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

  // In production, use bcrypt/argon2 to verify password
  if (!user || user.password !== password) {
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

// Initial setup endpoint to create the first admin
app.get('/setup', async (c) => {
  const db = getDb(c.env.DB)
  const existingUsers = await db.select().from(users).limit(1)
  
  if (existingUsers.length > 0) {
    return c.json({ error: 'System already setup' }, 400)
  }

  await db.insert(users).values({
    username: 'admin',
    password: 'admin-password', // Change this!
    name: 'System Admin',
    role: 'admin',
    phoneNumber: '0000000000',
    dateOfBirth: '2000-01-01'
  })

  return c.json({ message: 'Admin user created. Username: admin, Password: admin-password' })
})

app.get('/auth/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json({ user })
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

  try {
    const newUser = await db.insert(users).values({
      username,
      password, // In production, hash this
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
    imageUrl: body.imageUrl,
  }).returning()
  return c.json(newVoucher)
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

  return new Response(object.body, { headers })
})

app.patch('/vouchers/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin' && user.role !== 'cashier') return c.json({ error: 'Forbidden' }, 403)

  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const db = getDb(c.env.DB)

  const updatedVoucher = await db.update(vouchers)
    .set({
      description: body.description,
      imageUrl: body.imageUrl,
      status: body.status,
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
  const status = c.req.query('status') as 'available' | 'active' | 'claimed' | undefined
  const offset = (page - 1) * limit

  let query = db.select({
    id: vouchers.id,
    code: vouchers.code,
    status: vouchers.status,
    createdAt: vouchers.createdAt,
    expiryDate: vouchers.expiryDate,
    imageUrl: vouchers.imageUrl,
    description: vouchers.description,
    bindedToPhoneNumber: vouchers.bindedToPhoneNumber,
    approvedBy: vouchers.approvedBy,
    approvedAt: vouchers.approvedAt,
    usedAt: vouchers.usedAt,
    customerName: users.name,
  })
  .from(vouchers)
  .leftJoin(users, eq(vouchers.bindedToPhoneNumber, users.phoneNumber))

  let countQuery = db.select({ value: count() }).from(vouchers).where(isNull(vouchers.deletedAt))

  if (status) {
    // @ts-ignore
    query = query.where(and(isNull(vouchers.deletedAt), eq(vouchers.status, status)))
    // @ts-ignore
    countQuery = countQuery.where(and(isNull(vouchers.deletedAt), eq(vouchers.status, status)))
  } else {
    // @ts-ignore
    query = query.where(isNull(vouchers.deletedAt))
  }

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
      status: 'active',
      expiryDate: expiryDate
    })
    .where(eq(vouchers.code, code))
    .returning()
    
  return c.json(updatedVoucher)
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
      usedAt: new Date()
    })
    .where(eq(vouchers.code, code))
    .returning()
    
  return c.json(updatedVoucher)
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
    if (body.password) updateData.password = body.password
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

  const id = parseInt(c.req.param('id'))
  const db = getDb(c.env.DB)

  await db.update(vouchers)
    .set({ deletedAt: new Date() })
    .where(eq(vouchers.id, id))

  return c.json({ success: true })
})

export default app
