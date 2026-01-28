'use client'

import * as React from 'react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DateRangePickerProps {
  dateRange: DateRange | undefined
  onDateRangeChange: (range: DateRange | undefined) => void
  className?: string
}

const presets = [
  { label: 'Today', getRange: () => { const today = new Date(); return { from: today, to: today } } },
  { label: 'Last 7 days', getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Last 30 days', getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'This month (MTD)', getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Last month', getRange: () => { const lm = subMonths(new Date(), 1); return { from: startOfMonth(lm), to: endOfMonth(lm) } } },
  { label: 'Last 3 months', getRange: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
]

// Default to MTD (Month-to-date)
export function getDefaultDateRange(): DateRange {
  return { from: startOfMonth(new Date()), to: new Date() }
}

export function DateRangePicker({ dateRange, onDateRangeChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  // Track internal selection state for the two-click UX
  const [internalRange, setInternalRange] = React.useState<DateRange | undefined>(dateRange)
  const [selectionPhase, setSelectionPhase] = React.useState<'idle' | 'start-selected'>('idle')
  const [displayMonth, setDisplayMonth] = React.useState<Date>(dateRange?.from ?? startOfMonth(new Date()))

  // Sync internal range when external dateRange changes (e.g., from presets)
  React.useEffect(() => {
    setInternalRange(dateRange)
    if (dateRange?.from) {
      setDisplayMonth(dateRange.from)
    }
  }, [dateRange])

  // Reset selection phase when popover closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectionPhase('idle')
      setInternalRange(dateRange)
    }
  }, [isOpen, dateRange])

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      setInternalRange(undefined)
      setSelectionPhase('idle')
      return
    }

    // First click - only from date is set
    if (range.from && !range.to) {
      setInternalRange(range)
      setSelectionPhase('start-selected')
    }
    // Second click - range is complete
    else if (range.from && range.to) {
      setInternalRange(range)
      onDateRangeChange(range)
      setSelectionPhase('idle')
      // Popover stays open - user must click outside to close
    }
  }

  const handlePresetClick = (preset: typeof presets[number]) => {
    const range = preset.getRange()
    setInternalRange(range)
    onDateRangeChange(range)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-[300px] justify-start text-left font-normal', !dateRange && 'text-muted-foreground', className)}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>
            ) : format(dateRange.from, 'LLL dd, y')
          ) : <span>Pick a date range</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r p-3 space-y-1">
            <p className="text-sm font-medium mb-2">Quick select</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              selected={internalRange}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
            {selectionPhase === 'start-selected' && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Click another date to complete the range
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
