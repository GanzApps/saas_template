import type { ReactNode } from 'react'
import Link from 'next/link'
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import { FolderOpen, Settings } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <FolderOpen className="h-5 w-5" />
            FileVault
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Files</Link>
            <Link href="/settings" className="hover:text-foreground flex items-center gap-1">
              <Settings className="h-4 w-4" /> Settings
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <OrganizationSwitcher hidePersonal={false} />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
