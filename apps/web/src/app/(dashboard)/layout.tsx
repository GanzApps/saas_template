'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@saas/ui'
import {
  LayoutDashboard,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MapPin,
  Send,
  FileText,
} from 'lucide-react'
import { Button, Avatar, Dropdown, Separator } from '@saas/ui'
import { useState, useEffect } from 'react'
import { SignOutButton } from '@clerk/nextjs'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Reviews', href: '/reviews', icon: MessageSquare },
  { name: 'Locations', href: '/locations', icon: MapPin },
  { name: 'Campaigns', href: '/campaigns', icon: Send },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasAccounts, setHasAccounts] = useState(true)
  const [checkingAccounts, setCheckingAccounts] = useState(true)

  // Check if user has connected Google accounts
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetch('/api/accounts')
        .then(res => res.ok && res.json())
        .then(data => {
          setHasAccounts(Array.isArray(data) && data.length > 0)
          setCheckingAccounts(false)
        })
        .catch(() => {
          setHasAccounts(false)
          setCheckingAccounts(false)
        })
    }
  }, [isLoaded, isSignedIn])

  // Redirect to onboarding if no accounts connected (except for onboarding page itself)
  useEffect(() => {
    if (!checkingAccounts && isLoaded && isSignedIn && !hasAccounts && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [checkingAccounts, hasAccounts, isLoaded, isSignedIn, pathname, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) return null

  if (checkingAccounts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b">
            <Link href="/dashboard" className="text-xl font-bold">
              SaaS MVP
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="p-4 border-t">
            <Dropdown
              trigger={
                <button className="flex w-full items-center gap-3">
                  <Avatar
                    src={user?.imageUrl || undefined}
                    fallback={user?.firstName?.[0] || user?.username?.[0] || 'U'}
                    size="sm"
                  />
                  <div className="text-left min-w-0">
                    <p className="truncate font-medium text-sm">
                      {user?.fullName || user?.username || 'User'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              }
              items={[
                { label: 'Profile', onClick: () => {}, icon: <User className="h-4 w-4" /> },
                { label: 'Settings', onClick: () => {}, icon: <Settings className="h-4 w-4" /> },
                { type: 'separator' },
                { label: 'Sign out', onClick: () => {}, icon: <LogOut className="h-4 w-4" />, destructive: true },
              ]}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-8">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-accent"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          <SignOutButton
            afterSignOutUrl="/"
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </SignOutButton>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}