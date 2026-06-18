type Props = { params: { token: string } }

export default function SharePage({ params }: Props) {
  const downloadHref = `${(process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')}/api/public/download?token=${params.token}`
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Shared file</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;ve been sent a file via FileVault. Click below to download.
        </p>
        <a
          href={downloadHref}
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Download file
        </a>
        <p className="text-xs text-muted-foreground">
          Link expires according to the sender&rsquo;s settings.
        </p>
      </div>
    </div>
  )
}
