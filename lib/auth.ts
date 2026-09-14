import { createServerSupabase } from './supabase'
import { prisma } from './prisma'
import { DEMO_COOKIE, decodeDemoCookie, isDemoEmail } from './demo'

export async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    // Demo sandbox fallback: a signed cookie may identify a sandbox user on the demo domain
    const demoUser = await demoUserFromCookie()
    if (demoUser) return demoUser
    throw new Error('Unauthorized')
  }

  let dbUser = await prisma.user.findUnique({ where: { email: user.email! } })
  if (!dbUser) {
    dbUser = await prisma.user.create({ data: { email: user.email!, id: user.id } })
  }
  return dbUser
}

async function demoUserFromCookie() {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  const userId = decodeDemoCookie(store.get(DEMO_COOKIE)?.value)
  if (!userId) return null
  const dbUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!dbUser || !isDemoEmail(dbUser.email)) return null
  return dbUser
}
