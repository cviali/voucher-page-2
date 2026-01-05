# voucher management system

a simple app for managing and distributing vouchers, built with Next.js 15 and Cloudflare.

## features

- **customer portal**: mobile-optimized frontend to view vouchers and request claims.
- **admin dashboard**: manage vouchers, staff, and customers in one place.
- **voucher binding**: assign vouchers to customers via phone number with WhatsApp sharing.
- **Cloudflare native**: powered by Cloudflare D1 (SQL) and R2 (Storage).
- **dark mode**: full support for light and dark themes.

## tech stack

- **frontend**: Next.js 15 (App Router)
- **backend**: Hono (Cloudflare Workers)
- **database**: Cloudflare D1
- **storage**: Cloudflare R2
- **styling**: Tailwind CSS v4, Shadcn UI, Framer Motion

## development

### prerequisites

- node.js and npm
- cloudflare account with d1 and r2 enabled

### installation

```bash
npm install
```

### local development

```bash
npm run dev
```

### deployment

```bash
# frontend
npm run deploy

# api
npm run deploy-api
```

## database

the project uses drizzle orm.

```bash
# generate migrations
npm run db:generate

# apply migrations
npm run db:migrate:local
npm run db:migrate:prod
```
