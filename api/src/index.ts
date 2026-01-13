import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timing } from 'hono/timing'
import { Bindings, Variables } from './types'

// Routes
import auth from './routes/auth'
import users from './routes/users'
import vouchers from './routes/vouchers'
import customers from './routes/customers'
import templates from './routes/templates'
import stats from './routes/stats'
import audit from './routes/audit'
import visits from './routes/visits'

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

// Middleware
app.use('*', cors({
  origin: (origin) => {
    if (!origin || origin === 'null') return 'https://tch.vlocityarena.com'

    const isAllowed =
      origin.endsWith('vlocityarena.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    return isAllowed ? origin : 'https://tch.vlocityarena.com';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
}))

app.use('*', logger())
app.use('*', timing())

// Route Registration
app.route('/auth', auth)
app.route('/users', users)
app.route('/vouchers', vouchers)
app.route('/customer', customers)
app.route('/templates', templates)
app.route('/stats', stats)
app.route('/audit-logs', audit)
app.route('/visits', visits)

export default app
