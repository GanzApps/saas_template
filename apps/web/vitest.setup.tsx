import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: 'user_test123' }),
  useUser: () => ({ user: { id: 'user_test123', firstName: 'Test', lastName: 'User', fullName: 'Test User', primaryEmailAddress: { emailAddress: 'test@example.com' }, imageUrl: null } }),
  SignIn: () => <div data-testid="sign-in">Sign In</div>,
  SignUp: () => <div data-testid="sign-up">Sign Up</div>,
  SignOutButton: ({ children }: { children: React.ReactNode }) => <button data-testid="sign-out">{children}</button>,
}))

// Mock D1 client
vi.mock('@saas/db-d1', () => ({
  createD1Client: () => ({
    from: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    getOrganization: () => Promise.resolve({ id: 'org_test', name: 'Test Org', slug: 'test-org', plan: 'pro' }),
    listLocations: () => Promise.resolve([]),
  }),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))