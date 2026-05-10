import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

// Load .env so `drizzle-kit push` can see DATABASE_URL
config()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set (check your .env file)')
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: true,
  strict: true,
})
