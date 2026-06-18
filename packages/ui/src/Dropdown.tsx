'use client'

import * as React from 'react'
import { cn } from './utils'
import { ChevronDown, Check } from 'lucide-react'

interface DropdownProps {
  trigger: React.ReactNode
  items: Array<{
    label: string
    onClick: () => void
    icon?: React.ReactNode
    destructive?: boolean
    disabled?: boolean
  }>
  align?: 'start' | 'end'
}

export function Dropdown({ trigger, items, align = 'start' }: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
          contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {trigger}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={contentRef}
          className={cn(
            'absolute z-50 mt-1.5 min-w-[160px] rounded-md border bg-popover p-1 shadow-lg focus:outline-none',
            align === 'end' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => { item.onClick(); setOpen(false) }}
              disabled={item.disabled}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                'focus:bg-accent focus:text-accent-foreground',
                'disabled:pointer-events-none disabled:opacity-50',
                item.destructive ? 'text-destructive focus:bg-destructive/10 focus:text-destructive' : 'text-popover-foreground'
              )}
              role="menuitem"
            >
              {item.icon && <span className="h-4 w-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}