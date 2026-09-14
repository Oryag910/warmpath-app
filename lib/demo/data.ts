/**
 * Synthetic demo data for the public WarmPath recruiter demo.
 *
 * Everything in this file is fictional. Every person name is invented and
 * does not refer to any real individual, living or dead. Companies and
 * universities are real, well-known institutions used only as realistic
 * backdrop (nobody's actual employment or education is represented).
 *
 * This file has zero dependencies on the rest of the codebase and performs
 * no I/O — it is pure data generation, safe to import anywhere (including
 * a public demo route) without touching the database.
 */

export const DEMO_DOMAIN = 'demo.warmpath.local'
export const DEMO_TEMPLATE_EMAIL = `template@${DEMO_DOMAIN}`

export const DEMO_USER = {
  name: 'Jordan Rivera',
  schools: [{ name: 'University of Michigan', graduationYear: 2027 }],
  pastCompanies: ['Shopify'],
  organizations: ['Michigan Hackers', 'ACM'],
}

export const DEMO_JOB: {
  title: string
  company: 'Stripe'
  url: string | null
  rawDescription: string
} = {
  title: 'Software Engineering Intern (Summer 2027)',
  company: 'Stripe',
  url: null,
  rawDescription: `Stripe builds the financial infrastructure that powers commerce for millions of businesses, from individual creators to some of the largest companies in the world. Our Payments Infrastructure and Developer Platform teams are responsible for the core systems that move money reliably at massive scale and for the APIs, SDKs, and tools that let developers integrate Stripe in minutes. We are looking for a Software Engineering Intern to join us for Summer 2027 and work alongside full-time engineers on real, shipped systems from day one.

As an intern on these teams, you might work on the ledger and reconciliation systems that keep every transaction accurate, the API gateway that routes billions of requests a month, developer-facing tooling like the Stripe CLI and client libraries, or the internal platform services that let product teams ship safely at Stripe's scale. You'll pair with an engineering mentor, participate in code review, write production code that ships to real users, and present your project to the broader engineering org at the end of the summer.

What you'll do:
- Design, build, and ship a project that addresses a real problem for Stripe's payments or developer platform teams
- Write clean, well-tested code and participate actively in code review
- Collaborate closely with a mentor and cross-functional partners in product, design, and support
- Debug and reason about distributed systems at scale
- Present your work and your learnings to the team

What we're looking for:
- Currently pursuing a BS or MS in Computer Science or a related field, graduating between December 2027 and June 2028
- Strong foundation in data structures, algorithms, and computer systems fundamentals
- Experience with at least one general-purpose language (Ruby, Java, Go, TypeScript, Python, or similar); production experience with Ruby, Java, Go, or TypeScript is a plus
- Genuine curiosity about distributed systems, reliability, and financial infrastructure
- Comfort working with ambiguity and a strong bias toward shipping

Program details:
This is a 12-week, full-time paid internship running June through August 2027. Interns are paired with a dedicated mentor and a cohort of peers, and receive regular feedback throughout the summer. Strong performers are considered for full-time new-grad offers. This role can be based out of San Francisco, Seattle, or New York City, with relocation and housing assistance provided.

Stripe is an equal opportunity employer and values diversity of background and thought in building a team that reflects the global businesses we serve.`,
}

export interface DemoContact {
  name: string
  title: string | null
  company: string | null
  headline: string | null
  location: string | null
  relationshipStrength: 'weak' | 'medium' | 'strong'
  schoolOverlap: boolean
  companyOverlap: boolean
  notes: string | null
  educationHistory: { school: string; degree?: string; dateRange?: string }[]
  employmentHistory: { company: string; title?: string; dateRange?: string }[]
  organizations: { name: string; role?: string }[]
  skills: string[]
  enriched: boolean
  lastInteractionDate: string | null
}

const MICHIGAN = 'University of Michigan'

// ---------------------------------------------------------------------------
// Curated contacts — hand-written, rich, realistic. These anchor the demo.
// ---------------------------------------------------------------------------

const CURATED_CONTACTS: DemoContact[] = [
  {
    name: 'Priya Natarajan',
    title: 'Software Engineer, Payments Infrastructure',
    company: 'Stripe',
    headline: 'Software Engineer, Payments Infrastructure at Stripe',
    location: 'San Francisco',
    relationshipStrength: 'strong',
    schoolOverlap: true,
    companyOverlap: false,
    notes:
      "Met through Michigan Hackers; she was a TA for EECS 281 my freshman year. We've kept in touch.",
    educationHistory: [
      { school: MICHIGAN, degree: 'BS Computer Science', dateRange: '2019–2023' },
    ],
    employmentHistory: [
      { company: 'Stripe', title: 'Software Engineer, Payments Infrastructure', dateRange: '2023–present' },
      { company: 'Stripe', title: 'Software Engineering Intern', dateRange: 'Summer 2022' },
    ],
    organizations: [{ name: 'Michigan Hackers', role: 'Core Team' }],
    skills: ['Ruby', 'Distributed Systems', 'Payments', 'Go', 'SQL'],
    enriched: true,
    lastInteractionDate: '2026-07-20',
  },
  {
    name: 'Marcus Chen',
    title: 'Engineering Manager, Developer Platform',
    company: 'Stripe',
    headline: 'Engineering Manager, Developer Platform at Stripe',
    location: 'Seattle',
    relationshipStrength: 'weak',
    schoolOverlap: false,
    companyOverlap: false,
    notes: null,
    educationHistory: [{ school: 'Georgia Institute of Technology', degree: 'BS Computer Science' }],
    employmentHistory: [
      { company: 'Stripe', title: 'Engineering Manager, Developer Platform', dateRange: '2021–present' },
      { company: 'Twilio', title: 'Senior Software Engineer' },
    ],
    organizations: [],
    skills: ['Java', 'System Design', 'Leadership', 'APIs'],
    enriched: true,
    lastInteractionDate: null,
  },
  {
    name: 'Elena Rossi',
    title: 'University Recruiting Partner',
    company: 'Stripe',
    headline: 'University Recruiting Partner at Stripe',
    location: 'San Francisco',
    relationshipStrength: 'medium',
    schoolOverlap: false,
    companyOverlap: false,
    notes:
      'Spoke at the Michigan engineering career fair, Fall 2025. Mentioned they hire interns from the fall pool.',
    educationHistory: [{ school: 'UCLA' }],
    employmentHistory: [
      { company: 'Stripe', title: 'University Recruiting Partner', dateRange: '2022–present' },
      { company: 'Databricks', title: 'Campus Recruiter' },
    ],
    organizations: [],
    skills: ['Recruiting', 'Sourcing', 'Campus Programs', 'Employer Branding'],
    enriched: true,
    lastInteractionDate: '2025-10-02',
  },
  {
    name: 'Daniel Okafor',
    title: 'Software Engineer (New Grad)',
    company: 'Stripe',
    headline: 'Software Engineer (New Grad) at Stripe',
    location: 'San Francisco',
    relationshipStrength: 'medium',
    schoolOverlap: true,
    companyOverlap: false,
    notes:
      'Was two years ahead of me in Michigan Hackers. Did the Stripe intern → new grad conversion.',
    educationHistory: [
      { school: MICHIGAN, degree: 'BS Computer Science', dateRange: '2021–2025' },
    ],
    employmentHistory: [
      { company: 'Stripe', title: 'Software Engineer (New Grad)', dateRange: '2025–present' },
      { company: 'Stripe', title: 'Software Engineering Intern', dateRange: 'Summer 2024' },
      { company: 'Duolingo', title: 'Software Engineering Intern', dateRange: '2023' },
    ],
    organizations: [{ name: 'Michigan Hackers', role: 'Member' }],
    skills: ['TypeScript', 'React', 'Ruby', 'APIs'],
    enriched: true,
    lastInteractionDate: '2026-03-14',
  },
  {
    name: 'Sofia Alvarez',
    title: 'Senior Software Engineer',
    company: 'Ramp',
    headline: 'Senior Software Engineer at Ramp',
    location: 'New York',
    relationshipStrength: 'medium',
    schoolOverlap: false,
    companyOverlap: false,
    notes:
      'Was on a panel I attended about fintech engineering; we exchanged a few messages afterwards.',
    educationHistory: [{ school: 'University of Washington' }],
    employmentHistory: [
      { company: 'Ramp', title: 'Senior Software Engineer', dateRange: '2023–present' },
      { company: 'Stripe', title: 'Software Engineer, Billing', dateRange: '2019–2023' },
    ],
    organizations: [],
    skills: ['Python', 'Fintech', 'Billing Systems', 'SQL'],
    enriched: true,
    lastInteractionDate: '2026-01-11',
  },
  {
    name: 'James Whitfield',
    title: 'Product Manager',
    company: 'Figma',
    headline: 'Product Manager at Figma',
    location: 'San Francisco',
    relationshipStrength: 'weak',
    schoolOverlap: false,
    companyOverlap: false,
    notes: null,
    educationHistory: [{ school: 'Northwestern University' }],
    employmentHistory: [
      { company: 'Figma', title: 'Product Manager', dateRange: '2024–present' },
      { company: 'Stripe', title: 'Product Manager, Billing', dateRange: '2020–2024' },
    ],
    organizations: [],
    skills: ['Product Strategy', 'Roadmapping', 'Fintech', 'Analytics'],
    enriched: true,
    lastInteractionDate: null,
  },
  {
    name: 'Aisha Rahman',
    title: 'Account Executive, Enterprise',
    company: 'Stripe',
    headline: 'Account Executive, Enterprise at Stripe',
    location: 'New York',
    relationshipStrength: 'weak',
    schoolOverlap: true,
    companyOverlap: false,
    notes: null,
    educationHistory: [
      { school: MICHIGAN, degree: 'BBA, Ross School of Business', dateRange: '2017–2021' },
    ],
    employmentHistory: [
      { company: 'Stripe', title: 'Account Executive, Enterprise', dateRange: '2022–present' },
      { company: 'Salesforce', title: 'SDR' },
    ],
    organizations: [],
    skills: ['Sales', 'Enterprise Sales', 'Salesforce', 'Negotiation'],
    enriched: true,
    lastInteractionDate: null,
  },
  {
    name: 'Tom Becker',
    title: 'Staff Software Engineer, Terminal',
    company: 'Stripe',
    headline: 'Staff Software Engineer, Terminal at Stripe',
    location: 'San Francisco',
    relationshipStrength: 'weak',
    schoolOverlap: false,
    companyOverlap: false,
    notes: null,
    educationHistory: [{ school: 'University of California Berkeley' }],
    employmentHistory: [
      { company: 'Stripe', title: 'Staff Software Engineer, Terminal', dateRange: '2018–present' },
      { company: 'Square', title: 'Software Engineer' },
    ],
    organizations: [],
    skills: ['C++', 'Embedded Systems', 'Payments Hardware', 'Go'],
    enriched: true,
    lastInteractionDate: null,
  },
  {
    name: 'Lena Fischer',
    title: 'Software Engineer',
    company: 'Google',
    headline: 'Software Engineer at Google',
    location: 'San Francisco',
    relationshipStrength: 'strong',
    schoolOverlap: true,
    companyOverlap: false,
    notes: "Close friend from Michigan Hackers; we built a hackathon project together.",
    educationHistory: [
      { school: MICHIGAN, degree: 'BS Computer Science', dateRange: '2018–2022' },
    ],
    employmentHistory: [
      { company: 'Google', title: 'Software Engineer', dateRange: '2022–present' },
      { company: 'Google', title: 'Software Engineering Intern' },
    ],
    organizations: [{ name: 'Michigan Hackers', role: 'Alumni' }],
    skills: ['Python', 'Machine Learning', 'Distributed Systems'],
    enriched: true,
    lastInteractionDate: '2026-08-30',
  },
  {
    name: 'Kevin Park',
    title: 'Data Scientist',
    company: 'Meta',
    headline: 'Data Scientist at Meta',
    location: 'Menlo Park',
    relationshipStrength: 'medium',
    schoolOverlap: false,
    companyOverlap: false,
    notes: null,
    educationHistory: [{ school: 'University of Illinois Urbana-Champaign' }],
    employmentHistory: [{ company: 'Meta', title: 'Data Scientist', dateRange: '2021–present' }],
    organizations: [{ name: 'ACM', role: 'Member' }],
    skills: ['Python', 'SQL', 'Statistics', 'A/B Testing'],
    enriched: true,
    lastInteractionDate: null,
  },
  {
    name: 'Rachel Goldberg',
    title: 'Brand Manager',
    company: 'Procter & Gamble',
    headline: 'Brand Manager at Procter & Gamble',
    location: 'Cincinnati',
    relationshipStrength: 'strong',
    schoolOverlap: true,
    companyOverlap: false,
    notes: 'Family friend.',
    educationHistory: [
      { school: MICHIGAN, degree: 'BBA, Ross School of Business', dateRange: '2016–2020' },
    ],
    employmentHistory: [
      { company: 'Procter & Gamble', title: 'Brand Manager', dateRange: '2020–present' },
    ],
    organizations: [],
    skills: ['Brand Strategy', 'Marketing Analytics', 'Campaign Management'],
    enriched: true,
    lastInteractionDate: '2026-06-01',
  },
  {
    name: 'Omar Haddad',
    title: 'Senior Software Engineer',
    company: 'Shopify',
    headline: 'Senior Software Engineer at Shopify',
    location: 'Toronto',
    relationshipStrength: 'strong',
    schoolOverlap: false,
    companyOverlap: false,
    notes: 'My intern host at Shopify, summer 2026.',
    educationHistory: [{ school: 'University of Waterloo' }],
    employmentHistory: [
      { company: 'Shopify', title: 'Senior Software Engineer', dateRange: '2019–present' },
    ],
    organizations: [],
    skills: ['Ruby', 'React', 'E-commerce Platforms', 'System Design'],
    enriched: true,
    lastInteractionDate: '2026-08-25',
  },
  {
    name: 'Nina Petrova',
    title: 'Software Engineer',
    company: 'Adyen',
    headline: 'Software Engineer at Adyen',
    location: 'Amsterdam',
    relationshipStrength: 'weak',
    schoolOverlap: false,
    companyOverlap: false,
    notes: null,
    educationHistory: [{ school: 'TU Delft' }],
    employmentHistory: [{ company: 'Adyen', title: 'Software Engineer', dateRange: '2022–present' }],
    organizations: [],
    skills: ['Java', 'Payments', 'Distributed Systems'],
    enriched: true,
    lastInteractionDate: null,
  },
  {
    name: 'Carlos Mendes',
    title: 'Software Engineer',
    company: 'Plaid',
    headline: 'Software Engineer at Plaid',
    location: 'San Francisco',
    relationshipStrength: 'weak',
    schoolOverlap: false,
    companyOverlap: false,
    notes: null,
    educationHistory: [{ school: 'Stanford University' }],
    employmentHistory: [
      { company: 'Plaid', title: 'Software Engineer', dateRange: '2023–present' },
      { company: 'Plaid', title: 'Software Engineering Intern' },
    ],
    organizations: [],
    skills: ['TypeScript', 'APIs', 'Fintech'],
    enriched: true,
    lastInteractionDate: null,
  },
]

// ---------------------------------------------------------------------------
// Filler generation — deterministic PRNG + pools.
// ---------------------------------------------------------------------------

const SEED = 0x57415250 // 'WARP' as a fixed 32-bit seed
const TOTAL_CONTACTS = 1100

function mulberry32(seed: number): () => number {
  let a = seed
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)]
}

function chance(rng: () => number, p: number): boolean {
  return rng() < p
}

// Sample `count` distinct items from arr without replacement.
function sample<T>(rng: () => number, arr: readonly T[], count: number): T[] {
  const pool = arr.slice()
  const n = Math.min(count, pool.length)
  const result: T[] = []
  for (let i = 0; i < n; i++) {
    const idx = randInt(rng, 0, pool.length - 1)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }
  return result
}

const FIRST_NAMES: string[] = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth',
  'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Paul', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah',
  'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Frank', 'Christine', 'Gregory', 'Debra', 'Raymond', 'Alexander',
  'Patrick', 'Janet', 'Jack', 'Maria', 'Dennis', 'Heather', 'Jerry', 'Diane', 'Wei', 'Mei',
  'Hiroshi', 'Yuki', 'Aditya', 'Fatima', 'Mohammed', 'Sana', 'Diego', 'Ana', 'Luis', 'Javier',
  'Camila', 'Valentina', 'Kwame', 'Amara', 'Chidi', 'Ngozi', 'Yara', 'Layla', 'Zainab', 'Hassan',
  'Tariq', 'Jin', 'Minji', 'Haruto', 'Sakura', 'Arjun', 'Ananya', 'Ravi', 'Deepa', 'Ingrid',
]

const LAST_NAMES: string[] = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez',
  'Osei', 'Adeyemi', 'Okonkwo', 'Diallo', 'Haruna', 'Suzuki', 'Tanaka', 'Nakamura', 'Kobayashi', 'Choi',
  'Yoon', 'Nakagawa', 'Basu', 'Chowdhury', 'Iyer', 'Kapoor', 'Malhotra', 'Bergstrom', 'Larsson', 'Nowak',
]

const COMPANIES: string[] = [
  'Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix', 'Airbnb', 'Uber', 'Lyft', 'DoorDash',
  'Instacart', 'Robinhood', 'Coinbase', 'Plaid', 'Ramp', 'Brex', 'Chime', 'Affirm', 'Block', 'Adyen',
  'PayPal', 'Visa', 'Mastercard', 'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley', 'Bank of America', 'Citigroup', 'Wells Fargo', 'Capital One',
  'McKinsey & Company', 'Bain & Company', 'Boston Consulting Group', 'Deloitte', 'PwC', 'EY', 'KPMG', 'Accenture', 'Procter & Gamble', 'Unilever',
  'Johnson & Johnson', 'Pfizer', 'Moderna', 'UnitedHealth Group', 'CVS Health', 'Kaiser Permanente', 'Mayo Clinic', 'Nike', 'Adidas', 'Coca-Cola',
  'PepsiCo', 'Target', 'Walmart', 'Costco', 'Salesforce', 'Oracle', 'SAP', 'IBM', 'Intel', 'NVIDIA',
  'AMD', 'Cisco', 'Adobe', 'Shopify', 'Twilio', 'Snowflake', 'Databricks', 'Palantir', 'ServiceNow', 'Workday',
  'Zoom', 'Slack', 'Dropbox', 'Box', 'Atlassian', 'HubSpot', 'Intuit', 'Duolingo', 'Notion', 'Canva',
  'Asana', 'Pinterest', 'Snap Inc.', 'Reddit', 'Spotify', 'Roblox', 'Epic Games', 'Electronic Arts', 'Tesla', 'Rivian',
  'Ford', 'General Motors', 'Boeing', 'Lockheed Martin', 'General Electric', 'Honeywell', '3M', 'American Express',
]

const OTHER_UNIVERSITIES: string[] = [
  'University of California Berkeley', 'UCLA', 'Stanford University', 'MIT', 'Harvard University', 'Yale University',
  'Princeton University', 'Columbia University', 'Cornell University', 'University of Pennsylvania',
  'Duke University', 'Northwestern University', 'University of Chicago', 'New York University', 'University of Washington',
  'University of Illinois Urbana-Champaign', 'Georgia Institute of Technology', 'Carnegie Mellon University',
  'University of Texas at Austin', 'University of Wisconsin-Madison', 'Purdue University', 'Ohio State University',
  'Penn State University', 'Indiana University', 'University of Southern California', 'University of Virginia',
  'University of North Carolina at Chapel Hill', 'Boston University', 'Boston College', 'University of Florida',
  'Florida State University', 'Texas A&M University', 'Arizona State University', 'University of Arizona',
  'University of Colorado Boulder', 'University of Minnesota', 'Rutgers University', 'University of Maryland',
  'University of Notre Dame', 'Vanderbilt University', 'Emory University', 'Washington University in St. Louis',
  'University of Waterloo', 'McGill University', 'University of Toronto', 'TU Delft',
]

const CITIES: string[] = [
  'San Francisco', 'New York', 'Seattle', 'Chicago', 'Austin', 'Boston', 'Los Angeles', 'Denver',
  'Atlanta', 'Washington DC', 'Toronto', 'London', 'Miami', 'Dallas', 'Minneapolis',
]

const ORG_POOL: string[] = [
  'ACM', 'IEEE', 'Society of Women Engineers', 'National Society of Black Engineers', 'Toastmasters',
]
const MICHIGAN_HACKERS_ORG = 'Michigan Hackers'
const MAX_FILLER_MICHIGAN_HACKERS = 15

const DEGREES: string[] = ['BS', 'BA', 'BBA', 'MS', 'MBA']

const NOTE_POOL: string[] = [
  'Met at a networking event.',
  'Former colleague.',
  'Connected after a conference talk.',
  'Introduced by a mutual friend.',
  'We worked together briefly on a project.',
  'Met during a campus recruiting event.',
  'Old classmate.',
  'Connected on LinkedIn after a webinar.',
  'Former teammate from a hackathon.',
  'Mentor from an alumni panel.',
]

interface FunctionGroup {
  titles: string[]
  skills: string[]
}

const FUNCTIONS: FunctionGroup[] = [
  {
    titles: [
      'Software Engineering Intern', 'Software Engineer', 'Senior Software Engineer', 'Staff Software Engineer',
      'Engineering Manager', 'Director of Engineering', 'VP of Engineering', 'Site Reliability Engineer',
      'Data Engineer', 'Machine Learning Engineer', 'QA Engineer',
    ],
    skills: ['Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'C++', 'React', 'Distributed Systems', 'SQL', 'AWS', 'Kubernetes', 'Docker', 'System Design', 'REST APIs', 'GraphQL'],
  },
  {
    titles: ['Associate Product Manager', 'Product Manager', 'Senior Product Manager', 'Director of Product', 'VP of Product', 'Product Analyst'],
    skills: ['Product Strategy', 'Roadmapping', 'User Research', 'A/B Testing', 'SQL', 'Stakeholder Management', 'Agile', 'Jira', 'Prioritization', 'Analytics'],
  },
  {
    titles: ['UX Designer', 'UI/UX Designer', 'Product Designer', 'Senior Product Designer', 'Design Lead'],
    skills: ['Figma', 'UX Research', 'Wireframing', 'Prototyping', 'Design Systems', 'User Testing', 'Interaction Design', 'Visual Design'],
  },
  {
    titles: ['Data Analyst', 'Data Scientist', 'Senior Data Scientist', 'Analytics Manager', 'Business Intelligence Analyst'],
    skills: ['Python', 'SQL', 'R', 'Machine Learning', 'Statistics', 'Tableau', 'Data Visualization', 'A/B Testing', 'Pandas', 'Experimentation'],
  },
  {
    titles: ['Sales Development Representative', 'Account Executive', 'Enterprise Account Executive', 'Sales Manager', 'Regional Sales Director', 'VP of Sales'],
    skills: ['Prospecting', 'Salesforce', 'Negotiation', 'Pipeline Management', 'Cold Outreach', 'Relationship Building', 'Closing', 'CRM'],
  },
  {
    titles: ['Marketing Analyst', 'Marketing Manager', 'Brand Manager', 'Growth Marketing Manager', 'Content Marketing Manager', 'VP of Marketing'],
    skills: ['Content Strategy', 'SEO', 'Campaign Management', 'Brand Strategy', 'Copywriting', 'Social Media', 'Google Analytics', 'Marketing Automation'],
  },
  {
    titles: ['Financial Analyst', 'Senior Financial Analyst', 'Finance Manager', 'Investment Banking Analyst', 'Finance Associate'],
    skills: ['Financial Modeling', 'Excel', 'Valuation', 'Forecasting', 'Budgeting', 'Variance Analysis', 'GAAP'],
  },
  {
    titles: ['Business Operations Associate', 'Operations Manager', 'Supply Chain Analyst', 'Program Manager', 'VP of Operations'],
    skills: ['Process Improvement', 'Supply Chain', 'Project Management', 'Vendor Management', 'Logistics', 'Six Sigma'],
  },
  {
    titles: ['Technical Recruiter', 'University Recruiting Partner', 'Talent Acquisition Manager', 'HR Business Partner'],
    skills: ['Sourcing', 'Interviewing', 'ATS Systems', 'Employer Branding', 'Candidate Experience', 'Offer Negotiation'],
  },
  {
    titles: ['Associate Consultant', 'Consultant', 'Senior Consultant', 'Engagement Manager', 'Strategy Consultant'],
    skills: ['Problem Solving', 'Client Management', 'PowerPoint', 'Frameworks', 'Stakeholder Management', 'Data Analysis'],
  },
]

function pickRelationshipStrength(rng: () => number): 'weak' | 'medium' | 'strong' {
  const r = rng()
  if (r < 0.75) return 'weak'
  if (r < 0.95) return 'medium'
  return 'strong'
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function randomDateISO(rng: () => number): string {
  const year = pick(rng, [2024, 2025, 2026])
  const month = randInt(rng, 1, year === 2026 ? 9 : 12)
  const day = randInt(rng, 1, 28)
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function generateFillerContact(
  rng: () => number,
  usedNames: Set<string>,
  michiganHackersCount: { count: number },
): DemoContact {
  // Unique name via reroll on collision.
  let name = ''
  do {
    name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
  } while (usedNames.has(name))
  usedNames.add(name)

  let relationshipStrength = pickRelationshipStrength(rng)

  const isMichigan = chance(rng, 0.12)
  const school = isMichigan ? MICHIGAN : pick(rng, OTHER_UNIVERSITIES)

  // Filler Michigan alumni must never be a strong tie.
  if (isMichigan && relationshipStrength === 'strong') {
    relationshipStrength = chance(rng, 0.5) ? 'medium' : 'weak'
  }

  const fn = pick(rng, FUNCTIONS)
  const currentTitle = pick(rng, fn.titles)
  const currentCompany = pick(rng, COMPANIES)
  const enriched = chance(rng, 0.6)

  const employmentHistory: { company: string; title?: string; dateRange?: string }[] = []
  const currentStartYear = randInt(rng, 2019, 2025)
  employmentHistory.push({
    company: currentCompany,
    title: currentTitle,
    dateRange: `${currentStartYear}–present`,
  })

  if (enriched) {
    const priorJobCount = randInt(rng, 0, 2)
    let cursorYear = currentStartYear
    for (let i = 0; i < priorJobCount; i++) {
      const span = randInt(rng, 1, 3)
      const endYear = cursorYear
      const startYear = endYear - span
      const priorFn = pick(rng, FUNCTIONS)
      employmentHistory.push({
        company: pick(rng, COMPANIES),
        title: pick(rng, priorFn.titles),
        dateRange: `${startYear}–${endYear}`,
      })
      cursorYear = startYear
    }
  }

  const educationHistory: { school: string; degree?: string; dateRange?: string }[] = []
  if (enriched) {
    const gradYear = randInt(rng, 2010, 2025)
    educationHistory.push({
      school,
      degree: `${pick(rng, DEGREES)} ${fn === FUNCTIONS[0] ? 'Computer Science' : 'Business Administration'}`,
      dateRange: `${gradYear - 4}–${gradYear}`,
    })
    if (chance(rng, 0.1)) {
      educationHistory.push({ school: pick(rng, OTHER_UNIVERSITIES), degree: 'MBA' })
    }
  } else {
    educationHistory.push({ school })
  }

  const organizations: { name: string; role?: string }[] = []
  if (chance(rng, 0.2)) {
    const wantsHackers =
      chance(rng, 0.15) &&
      relationshipStrength !== 'strong' &&
      michiganHackersCount.count < MAX_FILLER_MICHIGAN_HACKERS
    if (wantsHackers) {
      organizations.push({ name: MICHIGAN_HACKERS_ORG })
      michiganHackersCount.count += 1
    } else {
      organizations.push({ name: pick(rng, ORG_POOL) })
    }
  }

  const skills = sample(rng, fn.skills, randInt(rng, 3, 6))

  const hasNotes = chance(rng, 0.05)
  const hasLastInteraction = chance(rng, 0.15)

  return {
    name,
    title: currentTitle,
    company: currentCompany,
    headline: enriched ? `${currentTitle} at ${currentCompany}` : null,
    location: enriched ? pick(rng, CITIES) : null,
    relationshipStrength,
    schoolOverlap: educationHistory.some((e) => e.school === MICHIGAN),
    companyOverlap: false,
    notes: hasNotes ? pick(rng, NOTE_POOL) : null,
    educationHistory,
    employmentHistory,
    organizations,
    skills,
    enriched,
    lastInteractionDate: hasLastInteraction ? randomDateISO(rng) : null,
  }
}

export function buildDemoContacts(): DemoContact[] {
  const rng = mulberry32(SEED)
  const usedNames = new Set<string>(CURATED_CONTACTS.map((c) => c.name))
  const michiganHackersCount = { count: 0 }

  const fillerCount = Math.max(0, TOTAL_CONTACTS - CURATED_CONTACTS.length)
  const filler: DemoContact[] = []
  for (let i = 0; i < fillerCount; i++) {
    filler.push(generateFillerContact(rng, usedNames, michiganHackersCount))
  }

  return [...CURATED_CONTACTS, ...filler]
}
