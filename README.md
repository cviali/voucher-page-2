# voucher management system

a full-stack application for managing and distributing vouchers, built with Next.js and Cloudflare.

## features

- admin dashboard for staff and customer management.
- voucher inventory with image uploads to Cloudflare R2.
- editable voucher descriptions and status tracking.
- customer portal to view active and used vouchers.
- secure login for customers using phone number and date of birth.
- staff authentication using JWT.
- soft delete implementation for users and vouchers.

## tech stack

- [Next.js 15](https://nextjs.org)
- [Hono](https://hono.dev)
- [Cloudflare D1](https://developers.cloudflare.com/d1) (SQL database)
- [Cloudflare R2](https://developers.cloudflare.com/r2) (object storage)
- [Drizzle ORM](https://orm.drizzle.team)
- [JWT](https://jwt.io) authentication
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn UI](https://ui.shadcn.com)

## development

### prerequisites

- Node.js and npm
- Cloudflare account with D1 and R2 enabled

### installation

```bash
npm install
```

### local development

run the Next.js development server:

```bash
npm run dev
```

### deployment

deploy the frontend to Cloudflare Pages:

```bash
npm run deploy
```

deploy the API to Cloudflare Workers:

```bash
npm run deploy-api
```

## database

the project uses Drizzle ORM for schema management. database migrations are handled via Wrangler for Cloudflare D1.
