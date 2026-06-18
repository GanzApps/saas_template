import Link from 'next/link'
import { Button } from '@saas/ui'
import { ArrowRight, CheckCircle, Zap, Shield, BarChart } from 'lucide-react'

const features = [
  { icon: Zap, title: 'Lightning Fast', desc: 'Edge-deployed API with Cloudflare Workers' },
  { icon: Shield, title: 'Secure by Default', desc: 'Clerk auth + Supabase RLS policies' },
  { icon: BarChart, title: 'Real-time Data', desc: 'Supabase Realtime subscriptions' },
  { icon: CheckCircle, title: 'Type-Safe', desc: 'End-to-end TypeScript from DB to UI' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-20 bg-gradient-to-b from-background to-muted/50">
        <div className="max-w-4xl w-full text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Build SaaS <span className="text-primary">Faster</span>
          </h1>
          <p className="mb-10 text-lg text-muted-foreground max-w-2xl mx-auto">
            Production-ready stack: Next.js 14 + Clerk + Supabase + Cloudflare Workers.
            Type-safe from database to UI. Deploy in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Building <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="mb-12 text-center text-3xl font-bold">Everything You Need</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <Icon className="mb-4 h-10 w-10 text-primary" aria-hidden="true" />
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="mb-4 text-2xl font-bold">Modern Stack</h2>
          <p className="mb-8 text-muted-foreground max-w-2xl mx-auto">
            Best-in-class tools that work together seamlessly
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="px-3 py-1 rounded bg-background border">Next.js 14</span>
            <span className="px-3 py-1 rounded bg-background border">Clerk</span>
            <span className="px-3 py-1 rounded bg-background border">Supabase</span>
            <span className="px-3 py-1 rounded bg-background border">Cloudflare Workers</span>
            <span className="px-3 py-1 rounded bg-background border">Hono</span>
            <span className="px-3 py-1 rounded bg-background border">Turborepo</span>
            <span className="px-3 py-1 rounded bg-background border">Tailwind CSS</span>
            <span className="px-3 py-1 rounded bg-background border">TypeScript</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>SaaS MVP — Built for speed, deployed with confidence.</p>
        </div>
      </footer>
    </main>
  )
}