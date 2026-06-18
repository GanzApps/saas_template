import { OrganizationProfile } from '@clerk/nextjs'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Manage your organization and members.
      </p>
      <OrganizationProfile routing="hash" />
    </div>
  )
}
