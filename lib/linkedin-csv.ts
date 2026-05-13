export interface LinkedInRow {
  firstName?: string
  lastName?: string
  url?: string
  email?: string
  company?: string
  position?: string
  connectedOn?: string
}

export interface ContactImportInput {
  name: string
  title: string | null
  company: string | null
  linkedinUrl: string | null
  email: string | null
  relationshipStrength: string
  source: string
}

function clean(value?: string): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

export function rowToContactInput(row: LinkedInRow): ContactImportInput | null {
  const first = clean(row.firstName)
  const last = clean(row.lastName)
  const name = [first, last].filter(Boolean).join(' ')
  if (!name) return null

  return {
    name,
    title: clean(row.position),
    company: clean(row.company),
    linkedinUrl: clean(row.url),
    email: clean(row.email),
    relationshipStrength: 'medium',
    source: 'linkedin_csv',
  }
}
