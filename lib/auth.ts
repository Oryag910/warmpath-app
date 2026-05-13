import { createServerSupabase } from './supabase'
import { prisma } from './prisma'

export async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized')
  }

  let dbUser = await prisma.user.findUnique({ where: { email: user.email! } })
  if (!dbUser) {
    dbUser = await prisma.user.create({ data: { email: user.email!, id: user.id } })
  }
  return dbUser
}
