'use client'

import { forwardRef, AnchorHTMLAttributes } from 'react'
import { ExternalLink as ExternalLinkIcon } from 'lucide-react'
import { cn } from './utils'

export const ExternalLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, children, ...props }, ref) => (
    <a
      ref={ref}
      className={cn('inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors', className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
      <ExternalLinkIcon className="h-3.5 w-3.5" />
    </a>
  )
)
ExternalLink.displayName = 'ExternalLink'