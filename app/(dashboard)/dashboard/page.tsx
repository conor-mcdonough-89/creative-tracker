'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { createClient } from '@/lib/supabase/client'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DateRangePicker, getDefaultDateRange } from '@/components/dashboard/DateRangePicker'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { GranularityToggle } from '@/components/dashboard/GranularityToggle'
import { TimeSeriesChart } from '@/components/dashboard/TimeSeriesChart'
import { PlatformBreakdownChart } from '@/components/dashboard/PlatformBreakdownChart'
import { SportBreakdownChart } from '@/components/dashboard/SportBreakdownChart'
import { usePlatformAdjustments } from '@/hooks/usePlatformAdjustments'
import {
  formatCurrency,
  formatPercentage,
  formatCompactNumber,
  aggregatePerformance,
  REVENUE_RATE,
} from '@/lib/calculations'
import type { Platform, Sport, Creator, AdPerformance, Granularity } from '@/lib/types'

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => getDefaultDateRange())
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [selectedCreators, setSelectedCreators] = useState<string[]>([])

  const [sports, setSports] = useState<Sport[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [performanceData, setPerformanceData] = useState<AdPerformance[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  // Load platform adjustments (for conversion discounts)
  usePlatformAdjustments()

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      const [sportsRes, creatorsRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('creators').select('*').order('name'),
      ])

      if (sportsRes.data) setSports(sportsRes.data as Sport[])
      if (creatorsRes.data) setCreators(creatorsRes.data as Creator[])
    }
    loadData()
  }, [supabase])

  // Load performance data based on filters - only matched ads (with creator)
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!dateRange?.from || !dateRange?.to) return

      setLoading(true)

      // Query the view that includes creator matching, filter for matched ads only
      let query = supabase
        .from('ads_with_creators')
        .select('*')
        .not('creator_id', 'is', null) // Only include ads matched to a creator
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'))

      if (selectedPlatforms.length > 0) {
        query = query.in('platform', selectedPlatforms)
      }

      if (selectedSports.length > 0) {
        query = query.in('sport_id', selectedSports)
      }

      if (selectedCreators.length > 0) {
        query = query.in('creator_id', selectedCreators)
      }

      const { data, error } = await query.order('date')

      if (data && !error) {
        setPerformanceData(data as AdPerformance[])
      }
      setLoading(false)
    }

    loadPerformanceData()
  }, [supabase, dateRange, selectedPlatforms, selectedSports, selectedCreators])

  // Calculate aggregated metrics
  const metrics = useMemo(() => {
    if (performanceData.length === 0) {
      return {
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
    }
    return aggregatePerformance(performanceData)
  }, [performanceData])

  // Prepare time series data
  const timeSeriesData = useMemo(() => {
    if (performanceData.length === 0) return { spend: [], conversionValue: [], roas: [] }

    // Group by date/week/month based on granularity
    const groupKey = (date: string): string => {
      const d = parseISO(date)
      switch (granularity) {
        case 'weekly':
          return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        case 'monthly':
          return format(startOfMonth(d), 'yyyy-MM')
        default:
          return date
      }
    }

    const grouped = performanceData.reduce((acc, record) => {
      const key = groupKey(record.date)
      if (!acc[key]) {
        acc[key] = { spend: 0, conversion_value: 0, impressions: 0 }
      }
      acc[key].spend += record.spend
      acc[key].conversion_value += record.conversion_value
      acc[key].impressions += record.impressions
      return acc
    }, {} as Record<string, { spend: number; conversion_value: number; impressions: number }>)

    const sortedKeys = Object.keys(grouped).sort()

    return {
      spend: sortedKeys.map((date) => ({
        date: granularity === 'monthly' ? format(parseISO(date + '-01'), 'MMM yyyy') : format(parseISO(date), 'MMM d'),
        value: grouped[date].spend,
      })),
      conversionValue: sortedKeys.map((date) => ({
        date: granularity === 'monthly' ? format(parseISO(date + '-01'), 'MMM yyyy') : format(parseISO(date), 'MMM d'),
        value: grouped[date].conversion_value,
      })),
      roas: sortedKeys.map((date) => ({
        date: granularity === 'monthly' ? format(parseISO(date + '-01'), 'MMM yyyy') : format(parseISO(date), 'MMM d'),
        value: grouped[date].spend > 0 ? grouped[date].conversion_value / grouped[date].spend : 0,
      })),
    }
  }, [performanceData, granularity])

  // Prepare platform breakdown
  const platformBreakdown = useMemo(() => {
    const grouped = performanceData.reduce((acc, record) => {
      if (!acc[record.platform]) {
        acc[record.platform] = { spend: 0, conversions: 0, conversion_value: 0 }
      }
      acc[record.platform].spend += record.spend
      acc[record.platform].conversions += record.conversions
      acc[record.platform].conversion_value += record.conversion_value
      return acc
    }, {} as Record<Platform, { spend: number; conversions: number; conversion_value: number }>)

    return {
      spend: Object.entries(grouped).map(([platform, data]) => ({
        platform: platform as Platform,
        value: data.spend,
      })),
      conversions: Object.entries(grouped).map(([platform, data]) => ({
        platform: platform as Platform,
        value: data.conversions,
      })),
    }
  }, [performanceData])

  // Prepare sport breakdown
  const sportBreakdown = useMemo(() => {
    const grouped = performanceData.reduce((acc, record) => {
      const sportId = record.sport_id || 'unassigned'
      if (!acc[sportId]) {
        acc[sportId] = 0
      }
      acc[sportId] += record.conversion_value
      return acc
    }, {} as Record<string, number>)

    return Object.entries(grouped).map(([sportId, value]) => {
      const sport = sports.find((s) => s.id === sportId)
      return {
        name: sport?.name || 'Unassigned',
        value,
      }
    })
  }, [performanceData, sports])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Track your ad creative performance across all platforms
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard
          title="Total Spend"
          value={formatCurrency(metrics.spend)}
          loading={loading}
        />
        <MetricCard
          title="Total Conversions"
          value={formatCompactNumber(metrics.conversions)}
          loading={loading}
        />
        <MetricCard
          title="Total GMV"
          value={formatCurrency(metrics.gmv)}
          description="Conversion Value"
          loading={loading}
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.revenue)}
          description={`${(REVENUE_RATE * 100).toFixed(1)}% of GMV`}
          loading={loading}
        />
        <MetricCard
          title="Blended ROAS"
          value={`${metrics.roas.toFixed(2)}x`}
          loading={loading}
        />
        <MetricCard
          title="Blended CPC"
          value={formatCurrency(metrics.cpc)}
          loading={loading}
        />
        <MetricCard
          title="Blended CPM"
          value={formatCurrency(metrics.cpm)}
          loading={loading}
        />
        <MetricCard
          title="Total Clicks"
          value={formatCompactNumber(metrics.clicks)}
          loading={loading}
        />
        <MetricCard
          title="Total Impressions"
          value={formatCompactNumber(metrics.impressions)}
          loading={loading}
        />
      </div>

      {/* Time Series Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance Over Time</h2>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>

      {/* Time Series Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="Conversion Value (GMV)"
          data={timeSeriesData.conversionValue}
          formatValue="currency"
          color="var(--chart-2)"
          loading={loading}
        />
        <TimeSeriesChart
          title="Spend"
          data={timeSeriesData.spend}
          formatValue="currency"
          color="var(--chart-1)"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="ROAS"
          data={timeSeriesData.roas}
          formatValue="number"
          color="var(--chart-3)"
          loading={loading}
        />
      </div>

      {/* Breakdown Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformBreakdownChart
          title="Spend by Platform"
          data={platformBreakdown.spend}
          formatValue="currency"
          loading={loading}
        />
        <SportBreakdownChart
          title="GMV by Sport"
          data={sportBreakdown}
          loading={loading}
        />
      </div>
    </div>
  )
}
