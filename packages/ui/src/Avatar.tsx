'use client'

import * as React from 'react'
import { cn } from './utils'
import { User, Loader2 } from 'lucide-react'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)

    if (isLoading && !imageError) {
      return (
        <div
          ref={ref}
          className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full', sizes[size], className)}
          {...props}
        >
          <Loader2 className="h-full w-full animate-spin text-muted-foreground" />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full', sizes[size], className)}
        {...props}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || fallback || 'Avatar'}
            className="aspect-square h-full w-full object-cover"
            onLoad={() => setIsLoading(false)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-muted">
            {fallback ? (
              <span className="font-medium text-foreground">{fallback}</span>
            ) : (
              <User className="h-1/2 w-1/2 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

export { Avatar }