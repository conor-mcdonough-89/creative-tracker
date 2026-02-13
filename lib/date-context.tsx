'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { DateRange } from 'react-day-picker'
import { startOfMonth, subDays, endOfMonth, subMonths } from 'date-fns'

const STORAGE_KEY = 'creative-tracker-date-range'

type DatePreset = 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'last_3_months' | 'custom'

interface StoredDateRange {
  preset: DatePreset
  // Only stored for custom ranges
  from?: string
  to?: string
}

function getPresetRange(preset: DatePreset): DateRange {
  const today = new Date()
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'last_7_days':
      return { from: subDays(today, 6), to: today }
    case 'last_30_days':
      return { from: subDays(today, 29), to: today }
    case 'this_month':
      return { from: startOfMonth(today), to: today }
    case 'last_month': {
      const lm = subMonths(today, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm) }
    }
    case 'last_3_months':
      return { from: subMonths(today, 3), to: today }
    default:
      return { from: startOfMonth(today), to: today }
  }
}

function detectPreset(range: DateRange | undefined): DatePreset {
  if (!range?.from || !range?.to) return 'this_month'

  const today = new Date()
  const from = range.from
  const to = range.to

  // Check each preset
  const presets: DatePreset[] = ['today', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'last_3_months']

  for (const preset of presets) {
    const presetRange = getPresetRange(preset)
    if (
      presetRange.from && presetRange.to &&
      from.toDateString() === presetRange.from.toDateString() &&
      to.toDateString() === presetRange.to.toDateString()
    ) {
      return preset
    }
  }

  return 'custom'
}

function loadFromStorage(): DateRange {
  if (typeof window === 'undefined') {
    return getPresetRange('this_month')
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return getPresetRange('this_month')

    const parsed: StoredDateRange = JSON.parse(stored)

    if (parsed.preset === 'custom' && parsed.from && parsed.to) {
      return {
        from: new Date(parsed.from),
        to: new Date(parsed.to),
      }
    }

    return getPresetRange(parsed.preset)
  } catch {
    return getPresetRange('this_month')
  }
}

function saveToStorage(range: DateRange | undefined) {
  if (typeof window === 'undefined' || !range?.from || !range?.to) return

  const preset = detectPreset(range)
  const stored: StoredDateRange = { preset }

  if (preset === 'custom') {
    stored.from = range.from.toISOString()
    stored.to = range.to.toISOString()
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

interface DateRangeContextValue {
  dateRange: DateRange | undefined
  setDateRange: (range: DateRange | undefined) => void
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null)

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateRange | undefined>(() => getPresetRange('this_month'))
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    setDateRangeState(loadFromStorage())
    setIsHydrated(true)
  }, [])

  const setDateRange = (range: DateRange | undefined) => {
    setDateRangeState(range)
    saveToStorage(range)
  }

  // Avoid hydration mismatch by only rendering children after hydration
  if (!isHydrated) {
    return null
  }

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const context = useContext(DateRangeContext)
  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider')
  }
  return context
}
