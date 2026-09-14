import { prisma } from './prisma'
import { rankContacts } from './claude'
import {
  MAX_COMPANY_CONTACTS, MAX_OTHER_CONTACTS, RECOMMEND_THRESHOLD, KEEP_THRESHOLD,
  CURRENT_EMPLOYEE_FLOOR, FORMER_EMPLOYEE_FLOOR,
  companyDistinctiveWords, hasCompanyMatch, isCurrentlyAtCompany, buildSharedAffiliations, heuristicScore,
  userSchoolNames, userOrgNames, employmentSummary,
} from './path-signals'

export * from './path-signals'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export interface RankResult {
  rankedCount: number
  totalContacts: number
  recommendedCount: number
}

/**
 * Rank a user's contacts for one job and persist the resulting WarmPaths.
 * `rankAll` runs the pre-filter over the whole network; otherwise `contactIds` are scored as given.
 * Nothing is deleted until Claude has returned scores, so a failed call leaves prior results intact.
 */
export async function rankJob(
  user: AnyRecord,
  job: AnyRecord,
  opts: { rankAll?: boolean; contactIds?: string[] }
): Promise<RankResult> {
  const allContacts: AnyRecord[] = opts.rankAll
    ? await prisma.contact.findMany({ where: { userId: user.id } })
    : await prisma.contact.findMany({ where: { id: { in: opts.contactIds ?? [] }, userId: user.id } })

  if (allContacts.length === 0) throw new Error('No contacts to rank')

  const words = companyDistinctiveWords(job.company)
  const userSchools = userSchoolNames(user)
  const userOrgs = userOrgNames(user)

  let contacts: AnyRecord[]
  if (opts.rankAll) {
    // Company-matched contacts fill the first pool (capped); rest fills the second pool by score
    const companyMatched = allContacts.filter(c => hasCompanyMatch(c, words)).slice(0, MAX_COMPANY_CONTACTS)
    const companyMatchedIds = new Set(companyMatched.map(c => c.id))
    const rest = allContacts
      .filter(c => {
        if (companyMatchedIds.has(c.id)) return false
        // Require at least one enrichment-based signal — school overlap alone isn't enough
        return buildSharedAffiliations(c, userSchools, userOrgs) || heuristicScore(c, words) >= 13
      })
      .sort((a, b) => heuristicScore(b, words) - heuristicScore(a, words))
      .slice(0, MAX_OTHER_CONTACTS)
    contacts = [...companyMatched, ...rest]
  } else {
    contacts = allContacts
  }

  // Claude sees short index IDs (c1, c2, …) instead of database cuids — long opaque IDs get
  // mis-copied in JSON output often enough to silently drop contacts from the results.
  const shortToId = new Map(contacts.map((c, i) => [`c${i + 1}`, c.id as string]))
  const rawScores = await rankContacts(
    { title: job.title, company: job.company, rawDescription: job.rawDescription },
    contacts.map((c, i) => ({
      id: `c${i + 1}`,
      name: c.name,
      title: c.title,
      company: c.company,
      relationshipStrength: c.relationshipStrength,
      schoolOverlap: c.schoolOverlap,
      companyOverlap: hasCompanyMatch(c, words),
      lastInteractionDate: c.lastInteractionDate,
      notes: c.notes,
      sharedAffiliations: buildSharedAffiliations(c, userSchools, userOrgs),
      currentlyAtTarget: isCurrentlyAtCompany(c, words),
      employmentSummary: employmentSummary(c),
    }))
  )

  const scores = rawScores
    .filter(s => shortToId.has(s.contactId))
    .map(s => ({ ...s, contactId: shortToId.get(s.contactId)! }))
  if (scores.length !== rawScores.length) {
    console.warn(`rankJob: ${rawScores.length - scores.length} scored contact(s) had unknown ids and were dropped`)
  }
  // Deterministic floors on top of the model's scores. Someone currently at the target company is a
  // real path by definition (at minimum a context ask), and a former employee is at least worth
  // knowing about — the model decides ordering and explanation, not whether the path exists.
  const byId = new Map(contacts.map(c => [c.id as string, c]))
  for (const s of scores) {
    const c = byId.get(s.contactId)!
    if (isCurrentlyAtCompany(c, words)) s.relevanceScore = Math.max(s.relevanceScore, CURRENT_EMPLOYEE_FLOOR)
    else if (hasCompanyMatch(c, words)) s.relevanceScore = Math.max(s.relevanceScore, FORMER_EMPLOYEE_FLOOR)
  }
  scores.sort((a, b) => b.relevanceScore - a.relevanceScore)

  const toKeep = scores.filter(s => s.relevanceScore >= KEEP_THRESHOLD)

  await prisma.$transaction([
    // On a full re-rank, wipe stale not_started rows so old scores don't bleed through
    ...(opts.rankAll
      ? [prisma.warmPath.deleteMany({ where: { jobId: job.id, status: 'not_started' } })]
      : []),
    prisma.warmPath.createMany({
      data: toKeep.map(s => ({ jobId: job.id, contactId: s.contactId })),
      skipDuplicates: true,
    }),
    ...toKeep.map(s =>
      prisma.warmPath.update({
        where: { jobId_contactId: { jobId: job.id, contactId: s.contactId } },
        data: {
          relevanceScore: s.relevanceScore,
          scoreReasoning: s.scoreReasoning,
          pathType: s.pathType,
          recommendedAsk: s.recommendedAsk,
          referralReadiness: s.referralReadiness,
          nextAction: s.nextAction,
        },
      })
    ),
  ])

  return {
    rankedCount: contacts.length,
    totalContacts: allContacts.length,
    recommendedCount: toKeep.filter(s => s.relevanceScore >= RECOMMEND_THRESHOLD).length,
  }
}
