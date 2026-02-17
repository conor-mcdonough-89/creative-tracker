'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { useDateRange } from '@/lib/date-context'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PartnerTable } from '@/components/partners/PartnerTable'
import { usePlatformAdjustments } from '@/hooks/usePlatformAdjustments'
import { aggregatePerformance, getPartnerStatus, calculatePartnerPayout, calculateMonthsInRange } from '@/lib/calculations'
import { Plus, Download } from 'lucide-react'
import type { Platform, Sport, Partner, PartnerPattern, AdPerformance, PartnerWithPerformance, PartnerStatus, CreatorVideo } from '@/lib/types'

export default function PartnersPage() {
  const { dateRange, setDateRange } = useDateRange()
  const [statusFilter, setStatusFilter] = useState<PartnerStatus | 'all'>('all')

  const [sports, setSports] = useState<Sport[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [patterns, setPatterns] = useState<PartnerPattern[]>([])
  const [performanceData, setPerformanceData] = useState<AdPerformance[]>([])
  const [videos, setVideos] = useState<CreatorVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState('calculated_payout')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const supabase = createClient()

  // Load platform adjustments (for conversion discounts)
  usePlatformAdjustments()

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      const [sportsRes, partnersRes, patternsRes, videosRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('partners').select('*').order('name'),
        supabase.from('partner_patterns').select('*'),
        supabase.from('creator_videos').select('*'),
      ])

      if (sportsRes.data) setSports(sportsRes.data as Sport[])
      if (partnersRes.data) setPartners(partnersRes.data as Partner[])
      if (patternsRes.data) setPatterns(patternsRes.data as PartnerPattern[])
      if (videosRes.data) setVideos(videosRes.data as CreatorVideo[])
    }
    loadData()
  }, [supabase])

  // Load performance data (use ads_with_partners view for proper matching)
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!dateRange?.from || !dateRange?.to) return

      setLoading(true)

      const query = supabase
        .from('ads_with_partners')
        .select('*')
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'))

      const { data, error } = await query

      if (data && !error) {
        setPerformanceData(data as AdPerformance[])
      }
      setLoading(false)
    }

    loadPerformanceData()
  }, [supabase, dateRange])

  // Calculate partner performance with status (use partner_id from ads_with_partners view)
  const partnersWithPerformance = useMemo((): PartnerWithPerformance[] => {
    return partners.map((partner) => {
      // Find ads matched to this partner via the view
      const matchingAds = performanceData.filter((ad) =>
        (ad as AdPerformance & { partner_id: string | null }).partner_id === partner.id
      )

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
      const partnerSports = sports.filter((s) => sportIds.includes(s.id))

      // Calculate status
      const status = getPartnerStatus(partner.contract_start_date, partner.contract_end_date)

      // Count videos for this partner (using patterns to match creator videos)
      // For now, we count videos that might be attributed via the converted_from_creator_id
      const videoCount = videos.filter(v =>
        v.creator_id === partner.converted_from_creator_id
      ).length

      // Calculate payout based on rate type
      const monthsInRange = dateRange?.from && dateRange?.to
        ? calculateMonthsInRange(dateRange.from, dateRange.to)
        : 1
      const calculatedPayout = calculatePartnerPayout(
        partner.rate,
        partner.rate_type,
        videoCount,
        monthsInRange
      )

      return {
        ...partner,
        performance,
        sports: partnerSports,
        matched_ads_count: matchingAds.length,
        status,
        video_count: videoCount,
        calculated_payout: calculatedPayout,
      }
    })
  }, [partners, patterns, performanceData, sports, videos, dateRange])

  // Filter by status
  const filteredPartners = useMemo(() => {
    if (statusFilter === 'all') return partnersWithPerformance
    return partnersWithPerformance.filter(p => p.status === statusFilter)
  }, [partnersWithPerformance, statusFilter])

  // Sort partners
  const sortedPartners = useMemo(() => {
    return [...filteredPartners].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'rate':
          aValue = a.rate
          bValue = b.rate
          break
        case 'gmv':
          aValue = a.performance.gmv
          bValue = b.performance.gmv
          break
        case 'video_count':
          aValue = a.video_count
          bValue = b.video_count
          break
        case 'calculated_payout':
          aValue = a.calculated_payout
          bValue = b.calculated_payout
          break
        default:
          aValue = a.calculated_payout
          bValue = b.calculated_payout
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
  }, [filteredPartners, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = { all: 0, prospect: 0, active: 0, ended: 0 }
    partnersWithPerformance.forEach(p => {
      counts.all++
      counts[p.status]++
    })
    return counts
  }, [partnersWithPerformance])

  const handleExportPayouts = () => {
    const dateLabel = dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}`
      : 'all_time'

    const headers = ['Partner Name', 'Handle', 'Status', 'Rate', 'Rate Type', 'Date Range', 'Videos', 'Payout Amount']
    const rows = sortedPartners.map((p) => [
      p.name,
      `@${p.handle}`,
      p.status,
      p.rate.toFixed(2),
      p.rate_type,
      dateLabel.replace(/_/g, ' '),
      p.video_count.toString(),
      p.calculated_payout.toFixed(2),
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partner_payouts_${dateLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground">
            Manage fixed-rate partners and their contracts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportPayouts}>
            <Download className="mr-2 h-4 w-4" />
            Export Payouts
          </Button>
          <Button asChild>
            <Link href="/partners/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Partner
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as PartnerStatus | 'all')}>
        <TabsList>
          <TabsTrigger value="all">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="prospect">
            Prospects ({statusCounts.prospect})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({statusCounts.active})
          </TabsTrigger>
          <TabsTrigger value="ended">
            Ended ({statusCounts.ended})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Date Range */}
      <div className="flex justify-end">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Partner Table */}
      <PartnerTable
        partners={sortedPartners}
        loading={loading}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  )
}
