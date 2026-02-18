'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { useDateRange } from '@/lib/date-context'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { CreatorTable } from '@/components/creators/CreatorTable'
import { usePlatformAdjustments } from '@/hooks/usePlatformAdjustments'
import { aggregatePerformance } from '@/lib/calculations'
import { Plus, Download, Receipt } from 'lucide-react'
import type { Platform, Sport, Creator, CreatorPattern, AdWithRelations, CreatorWithPerformance } from '@/lib/types'

export default function CreatorsPage() {
  const router = useRouter()
  const { dateRange, setDateRange } = useDateRange()
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [selectedCreators, setSelectedCreators] = useState<string[]>([])

  const [sports, setSports] = useState<Sport[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [patterns, setPatterns] = useState<CreatorPattern[]>([])
  const [performanceData, setPerformanceData] = useState<AdWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('payout')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [generatingPayout, setGeneratingPayout] = useState(false)
  const [payoutError, setPayoutError] = useState<string | null>(null)

  const supabase = createClient()

  // Load platform adjustments (for conversion discounts)
  usePlatformAdjustments()

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      const [sportsRes, creatorsRes, patternsRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('creators').select('*').order('name'),
        supabase.from('creator_patterns').select('*'),
      ])

      if (sportsRes.data) setSports(sportsRes.data as Sport[])
      if (creatorsRes.data) setCreators(creatorsRes.data as Creator[])
      if (patternsRes.data) setPatterns(patternsRes.data as CreatorPattern[])
    }
    loadData()
  }, [supabase])

  // Load performance data (use ads_with_creators view for proper matching)
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!dateRange?.from || !dateRange?.to) return

      setLoading(true)

      let query = supabase
        .from('ads_with_creators')
        .select('*')
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'))

      if (selectedPlatforms.length > 0) {
        query = query.in('platform', selectedPlatforms)
      }

      if (selectedSports.length > 0) {
        query = query.in('sport_id', selectedSports)
      }

      const { data, error } = await query

      if (data && !error) {
        setPerformanceData(data as AdWithRelations[])
      }
      setLoading(false)
    }

    loadPerformanceData()
  }, [supabase, dateRange, selectedPlatforms, selectedSports])

  // Calculate creator performance (use creator_id from ads_with_creators view)
  const creatorsWithPerformance = useMemo((): CreatorWithPerformance[] => {
    return creators.map((creator) => {
      // Find ads matched to this creator (via patterns, manual links, or video captions)
      const matchingAds = performanceData.filter((ad) => ad.creator_id === creator.id)

      // Aggregate performance
      const performance = matchingAds.length > 0
        ? aggregatePerformance(matchingAds)
        : {
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            conversion_value: 0,
            video_views: 0,
            ctr: 0,
            cpm: 0,
            cpc: 0,
            roas: 0,
            gmv: 0,
            revenue: 0,
            payout: 0,
          }

      // Get unique sports from matched ads
      const sportIds = [...new Set(matchingAds.map((ad) => ad.sport_id).filter(Boolean))]
      const creatorSports = sports.filter((s) => sportIds.includes(s.id))

      return {
        ...creator,
        performance,
        sports: creatorSports,
        matched_ads_count: matchingAds.length,
      }
    })
  }, [creators, patterns, performanceData, sports])

  // Sort creators
  const sortedCreators = useMemo(() => {
    return [...creatorsWithPerformance].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'gmv':
          aValue = a.performance.gmv
          bValue = b.performance.gmv
          break
        case 'revenue':
          aValue = a.performance.revenue
          bValue = b.performance.revenue
          break
        case 'payout':
          aValue = a.performance.payout
          bValue = b.performance.payout
          break
        case 'clicks':
          aValue = a.performance.clicks
          bValue = b.performance.clicks
          break
        case 'conversions':
          aValue = a.performance.conversions
          bValue = b.performance.conversions
          break
        case 'roas':
          aValue = a.performance.roas
          bValue = b.performance.roas
          break
        default:
          aValue = a.performance.payout
          bValue = b.performance.payout
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  }, [creatorsWithPerformance, sortField, sortDirection])

  // Filter creators by selection
  const filteredCreators = useMemo(() => {
    if (selectedCreators.length === 0) return sortedCreators
    return sortedCreators.filter((c) => selectedCreators.includes(c.id))
  }, [sortedCreators, selectedCreators])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleExportPayouts = () => {
    const dateLabel = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
      : 'all_time'

    const headers = ['Creator Name', 'Handle', 'Date Range', 'GMV', 'Revenue', 'Payout Amount']
    const rows = filteredCreators.map((c) => [
      c.name,
      `@${c.handle}`,
      dateLabel.replace(/_/g, ' '),
      c.performance.gmv.toFixed(2),
      c.performance.revenue.toFixed(2),
      c.performance.payout.toFixed(2),
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `creator_payouts_${dateLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Check if Generate Payout button should be enabled
  const canGeneratePayout = selectedCreators.length === 1 && dateRange?.from && dateRange?.to

  // Get selected creator's payout amount
  const selectedCreatorPayout = useMemo(() => {
    if (selectedCreators.length !== 1) return 0
    const creator = creatorsWithPerformance.find(c => c.id === selectedCreators[0])
    return creator?.performance.payout || 0
  }, [selectedCreators, creatorsWithPerformance])

  const handleGeneratePayout = async () => {
    if (!canGeneratePayout || !dateRange?.from || !dateRange?.to) return

    setGeneratingPayout(true)
    setPayoutError(null)

    const creatorId = selectedCreators[0]
    const creator = creators.find(c => c.id === creatorId)
    if (!creator) {
      setPayoutError('Creator not found')
      setGeneratingPayout(false)
      return
    }

    const dateStart = format(dateRange.from, 'yyyy-MM-dd')
    const dateEnd = format(dateRange.to, 'yyyy-MM-dd')

    try {
      // Check for overlapping payouts
      const { data: existingPayouts, error: checkError } = await supabase
        .from('payouts')
        .select('id, date_start, date_end')
        .eq('creator_id', creatorId)
        .lte('date_start', dateEnd)
        .gte('date_end', dateStart)

      if (checkError) throw checkError

      if (existingPayouts && existingPayouts.length > 0) {
        const overlap = existingPayouts[0]
        setPayoutError(
          `A payout already exists for ${creator.name} with overlapping dates (${overlap.date_start} to ${overlap.date_end}). Please choose a different date range.`
        )
        setGeneratingPayout(false)
        return
      }

      // Create the payout
      const { error: insertError } = await supabase
        .from('payouts')
        .insert({
          creator_id: creatorId,
          payout_method: creator.payout_method,
          payout_username: creator.payout_username,
          date_start: dateStart,
          date_end: dateEnd,
          amount: selectedCreatorPayout,
          status: 'unpaid',
        })

      if (insertError) throw insertError

      // Navigate to payouts page
      router.push('/payouts')
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Failed to generate payout')
    } finally {
      setGeneratingPayout(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="text-muted-foreground">
            Manage creators and view their performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPayouts}>
            <Download className="mr-2 h-4 w-4" />
            Export Payouts
          </Button>
          <Button asChild>
            <Link href="/creators/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Creator
            </Link>
          </Button>
        </div>
      </div>

      {/* Error message */}
      {payoutError && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">
          {payoutError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            platforms={['meta', 'tiktok', 'google']}
            selectedPlatforms={selectedPlatforms}
            onPlatformsChange={setSelectedPlatforms}
            sports={sports}
            selectedSports={selectedSports}
            onSportsChange={setSelectedSports}
            creators={creators}
            selectedCreators={selectedCreators}
            onCreatorsChange={setSelectedCreators}
          />
          <Button
            onClick={handleGeneratePayout}
            disabled={!canGeneratePayout || generatingPayout}
            className="h-8"
            style={{
              backgroundColor: canGeneratePayout ? '#4E695D' : undefined,
              borderColor: canGeneratePayout ? '#4E695D' : undefined,
            }}
            variant={canGeneratePayout ? 'default' : 'outline'}
          >
            <Receipt className="mr-1 h-3 w-3" />
            {generatingPayout ? 'Generating...' : 'Generate Payout'}
          </Button>
        </div>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Creator Table */}
      <CreatorTable
        creators={filteredCreators}
        loading={loading}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  )
}
