import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: '6fe9e0cc-c949-465a-bcb4-e74eaba01f44',
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
});
