import { requireUser } from '@/lib/auth'
import ProfileForm from './profile-form'

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell WarmPath about your background so it can find stronger connections automatically.
        </p>
      </div>
      <ProfileForm
        initialSchools={(user.schools as any[]) ?? []}
        initialPastCompanies={(user.pastCompanies as any[]) ?? []}
        initialOrganizations={(user.organizations as any[]) ?? []}
      />
    </div>
  )
}
