// Import this FIRST in scripts: loads .env (Prisma) and .env.local (Next.js) before any module
// that reads process.env at import time (e.g. the Anthropic client in lib/claude.ts).
import { config } from 'dotenv'
config()
config({ path: '.env.local' })
