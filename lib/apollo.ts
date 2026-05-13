export interface EducationEntry {
  school: string
  degree?: string
}

export interface EmploymentEntry {
  company: string
  title?: string
}

export interface ApolloPerson {
  name: string
  title: string | null
  linkedinUrl: string | null
  email: string | null
  organizationName: string | null
  educationHistory: EducationEntry[]
  employmentHistory: EmploymentEntry[]
}

export class ApolloNotConfiguredError extends Error {
  constructor() {
    super('Apollo is not configured — set APOLLO_API_KEY')
    this.name = 'ApolloNotConfiguredError'
  }
}

function isRealEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length > 0 && !email.includes('email_not_unlocked')
}

export async function searchPeopleAtCompany(company: string, titles: string[]): Promise<ApolloPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY
  if (!apiKey) throw new ApolloNotConfiguredError()

  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      organization_names: [company],
      person_titles: titles,
      page: 1,
      per_page: 25,
    }),
  })

  if (!res.ok) {
    throw new Error(`Apollo API error: ${res.status}`)
  }

  const data = await res.json()
  const people: any[] = Array.isArray(data?.people) ? data.people : []

  return people
    .map((p): ApolloPerson => ({
      name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(' '),
      title: p.title ?? null,
      linkedinUrl: p.linkedin_url ?? null,
      email: isRealEmail(p.email) ? p.email : null,
      organizationName: p.organization?.name ?? p.organization_name ?? null,
      educationHistory: (Array.isArray(p.education) ? p.education : [])
        .map((e: any) => ({
          school: e.school?.name ?? e.school_name ?? '',
          degree: e.degree ?? undefined,
        }))
        .filter((e: EducationEntry) => e.school),
      employmentHistory: (Array.isArray(p.employment_history) ? p.employment_history : [])
        .map((e: any) => ({
          company: e.organization_name ?? e.company ?? '',
          title: e.title ?? undefined,
        }))
        .filter((e: EmploymentEntry) => e.company),
    }))
    .filter(p => p.name && p.name.trim().length > 0)
}
