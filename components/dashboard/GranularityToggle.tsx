'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Granularity } from '@/lib/types'

interface GranularityToggleProps {
  value: Granularity
  onChange: (granularity: Granularity) => void
}

export function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  const options: { label: string; value: Granularity }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ]

  return (
    <div className="inline-flex items-center rounded-md border p-1">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'secondary' : 'ghost'}
          size="sm"
          className={cn(
            'h-7 px-3',
            value === option.value && 'bg-secondary'
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
