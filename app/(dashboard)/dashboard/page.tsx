'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, startOfMonth, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { useDateRange } from '@/lib/date-context'
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
  getPartnerStatus,
  calculatePartnerPayout,
  calculateMonthsInRange,
} from '@/lib/calculations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { Platform, Sport, Creator, AdWithRelations, Granularity, Partner, PartnerPattern, CreatorVideo, PartnerStatus } from '@/lib/types'

export default function DashboardPage() {
  const { dateRange, setDateRange } = useDateRange()
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [selectedCreators, setSelectedCreators] = useState<string[]>([])

  const [sports, setSports] = useState<Sport[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerPatterns, setPartnerPatterns] = useState<PartnerPattern[]>([])
  const [videos, setVideos] = useState<CreatorVideo[]>([])
  const [performanceData, setPerformanceData] = useState<AdWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  // Load platform adjustments (for conversion discounts)
  usePlatformAdjustments()

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      const [sportsRes, creatorsRes, partnersRes, partnerPatternsRes, videosRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('creators').select('*').order('name'),
        supabase.from('partners').select('*').order('name'),
        supabase.from('partner_patterns').select('*'),
        supabase.from('creator_videos').select('*'),
      ])

      if (sportsRes.data) setSports(sportsRes.data as Sport[])
      if (creatorsRes.data) setCreators(creatorsRes.data as Creator[])
      if (partnersRes.data) setPartners(partnersRes.data as Partner[])
      if (partnerPatternsRes.data) setPartnerPatterns(partnerPatternsRes.data as PartnerPattern[])
      if (videosRes.data) setVideos(videosRes.data as CreatorVideo[])
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
        setPerformanceData(data as AdWithRelations[])
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
    if (performanceData.length === 0) return { spend: [], conversionValue: [], roas: [], clicks: [] }

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
        acc[key] = { spend: 0, conversion_value: 0, impressions: 0, clicks: 0 }
      }
      // Use pre-adjusted conversion value from database
      acc[key].spend += record.spend
      acc[key].conversion_value += record.adjusted_conversion_value ?? record.conversion_value
      acc[key].impressions += record.impressions
      acc[key].clicks += record.clicks
      return acc
    }, {} as Record<string, { spend: number; conversion_value: number; impressions: number; clicks: number }>)

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
      clicks: sortedKeys.map((date) => ({
        date: granularity === 'monthly' ? format(parseISO(date + '-01'), 'MMM yyyy') : format(parseISO(date), 'MMM d'),
        value: grouped[date].clicks,
      })),
    }
  }, [performanceData, granularity])

  // Prepare platform breakdown
  const platformBreakdown = useMemo(() => {
    const grouped = performanceData.reduce((acc, record) => {
      if (!acc[record.platform]) {
        acc[record.platform] = { spend: 0, conversions: 0, conversion_value: 0 }
      }
      // Use pre-adjusted values from database
      acc[record.platform].spend += record.spend
      acc[record.platform].conversions += record.adjusted_conversions ?? record.conversions
      acc[record.platform].conversion_value += record.adjusted_conversion_value ?? record.conversion_value
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
      // Use pre-adjusted conversion value from database
      acc[sportId] += record.adjusted_conversion_value ?? record.conversion_value
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

  // Calculate partner payouts for the selected date range
  const partnerPayouts = useMemo(() => {
    const monthsInRange = dateRange?.from && dateRange?.to
      ? calculateMonthsInRange(dateRange.from, dateRange.to)
      : 1

    // Only include active partners
    const activePartners = partners.filter((partner) => {
      const status = getPartnerStatus(partner.contract_start_date, partner.contract_end_date)
      return status === 'active'
    })

    const partnerData = activePartners.map((partner) => {
      // Count videos for this partner (linked via converted_from_creator_id)
      const videoCount = videos.filter(
        (v) => v.creator_id === partner.converted_from_creator_id
      ).length

      const payout = calculatePartnerPayout(
        partner.rate,
        partner.rate_type,
        videoCount,
        monthsInRange
      )

      return {
        id: partner.id,
        name: partner.name,
        handle: partner.handle,
        rate: partner.rate,
        rateType: partner.rate_type,
        videoCount,
        payout,
      }
    })

    const totalPayout = partnerData.reduce((sum, p) => sum + p.payout, 0)

    return {
      partners: partnerData,
      total: totalPayout,
      count: activePartners.length,
    }
  }, [partners, videos, dateRange])

  // Calculate creator payouts based on performance data
  const creatorPayouts = useMemo(() => {
    // Group performance by creator
    const creatorPerformance = performanceData.reduce((acc, record) => {
      if (!record.creator_id) return acc

      if (!acc[record.creator_id]) {
        acc[record.creator_id] = {
          gmv: 0,
          spend: 0,
        }
      }
      // Use adjusted conversion value if available
      acc[record.creator_id].gmv += record.adjusted_conversion_value ?? record.conversion_value
      acc[record.creator_id].spend += record.spend
      return acc
    }, {} as Record<string, { gmv: number; spend: number }>)

    // Calculate payouts for each creator
    const creatorData = creators
      .map((creator) => {
        const perf = creatorPerformance[creator.id]
        if (!perf || perf.gmv === 0) return null

        const revenue = perf.gmv * REVENUE_RATE
        const payout = revenue * 0.10 // 10% of revenue

        return {
          id: creator.id,
          name: creator.name,
          handle: creator.handle,
          gmv: perf.gmv,
          payout,
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.payout - a.payout)

    const totalPayout = creatorData.reduce((sum, c) => sum + c.payout, 0)

    return {
      creators: creatorData,
      total: totalPayout,
      count: creatorData.length,
    }
  }, [creators, performanceData])

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
        <TimeSeriesChart
          title="Total Clicks"
          data={timeSeriesData.clicks}
          formatValue="number"
          color="var(--chart-4)"
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

      {/* Partner Payouts Section */}
      {partnerPayouts.count > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Partner Payouts</h2>
            <Link href="/partners" className="text-sm text-primary hover:underline">
              View all partners
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="text-base">Total Partner Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(partnerPayouts.total)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {partnerPayouts.count} active partner{partnerPayouts.count !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Partner Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {partnerPayouts.partners.slice(0, 5).map((partner) => (
                    <div key={partner.id} className="flex items-center justify-between">
                      <div>
                        <Link
                          href={`/partners/${partner.id}`}
                          className="font-medium hover:underline"
                        >
                          {partner.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(partner.rate)}/{partner.rateType === 'per_video' ? 'video' : 'month'}
                          {partner.rateType === 'per_video' && ` x ${partner.videoCount}`}
                        </p>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(partner.payout)}
                      </span>
                    </div>
                  ))}
                  {partnerPayouts.partners.length > 5 && (
                    <Link
                      href="/partners"
                      className="block text-sm text-primary hover:underline"
                    >
                      +{partnerPayouts.partners.length - 5} more
                    </Link>
                  )}
                  {partnerPayouts.partners.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active partners</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Creator Payouts Section */}
      {creatorPayouts.count > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Creator Payouts</h2>
            <Link href="/creators" className="text-sm text-primary hover:underline">
              View all creators
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-green-50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="text-base">Total Creator Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(creatorPayouts.total)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {creatorPayouts.count} creator{creatorPayouts.count !== 1 ? 's' : ''} with performance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Creator Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creatorPayouts.creators.slice(0, 5).map((creator) => (
                    <div key={creator.id} className="flex items-center justify-between">
                      <div>
                        <Link
                          href={`/creators/${creator.id}`}
                          className="font-medium hover:underline"
                        >
                          {creator.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(creator.gmv)} GMV
                        </p>
                      </div>
                      <span className="font-medium text-green-600">
                        {formatCurrency(creator.payout)}
                      </span>
                    </div>
                  ))}
                  {creatorPayouts.creators.length > 5 && (
                    <Link
                      href="/creators"
                      className="block text-sm text-primary hover:underline"
                    >
                      +{creatorPayouts.creators.length - 5} more
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
