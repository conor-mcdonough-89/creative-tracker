'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { DateRangePicker, getDefaultDateRange } from '@/components/dashboard/DateRangePicker'
import { GranularityToggle } from '@/components/dashboard/GranularityToggle'
import { TimeSeriesChart } from '@/components/dashboard/TimeSeriesChart'
import { PlatformBreakdownChart } from '@/components/dashboard/PlatformBreakdownChart'
import { PartnerPayoutCalculator } from '@/components/partners/PartnerPayoutCalculator'
import {
  formatCurrency,
  formatCompactNumber,
  aggregatePerformance,
  getPartnerStatus,
  calculateMonthsInRange,
} from '@/lib/calculations'
import { Edit, Trash2, ExternalLink, Calendar } from 'lucide-react'
import type { Partner, PartnerPattern, AdPerformance, Sport, Platform, Granularity, CreatorVideo, PartnerStatus } from '@/lib/types'
import { parseISO, startOfWeek, startOfMonth } from 'date-fns'

const STATUS_BADGES: Record<PartnerStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  prospect: { label: 'Prospect', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  ended: { label: 'Ended', variant: 'outline' },
}

export default function PartnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const partnerId = params.id as string

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => getDefaultDateRange())
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const [partner, setPartner] = useState<Partner | null>(null)
  const [patterns, setPatterns] = useState<PartnerPattern[]>([])
  const [performanceData, setPerformanceData] = useState<AdPerformance[]>([])
  const [videos, setVideos] = useState<CreatorVideo[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()

  // Load partner and patterns
  useEffect(() => {
    const loadPartner = async () => {
      const [partnerRes, patternsRes, sportsRes, videosRes] = await Promise.all([
        supabase.from('partners').select('*').eq('id', partnerId).single(),
        supabase.from('partner_patterns').select('*').eq('partner_id', partnerId),
        supabase.from('sports').select('*').order('name'),
        supabase.from('creator_videos').select('*'),
      ])

      if (partnerRes.data) setPartner(partnerRes.data as Partner)
      if (patternsRes.data) setPatterns(patternsRes.data as PartnerPattern[])
      if (sportsRes.data) setSports(sportsRes.data as Sport[])
      if (videosRes.data) setVideos(videosRes.data as CreatorVideo[])
    }
    loadPartner()
  }, [supabase, partnerId])

  // Load performance data
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!dateRange?.from || !dateRange?.to || patterns.length === 0) {
        setLoading(false)
        return
      }

      setLoading(true)

      // Build query with pattern matching
      const patternFilters = patterns.map((p) => `ad_name.ilike.%${p.pattern}%`)

      const { data, error } = await supabase
        .from('ad_performance')
        .select('*')
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
        .or(patternFilters.join(','))
        .order('date', { ascending: false })

      if (data && !error) {
        setPerformanceData(data as AdPerformance[])
      }
      setLoading(false)
    }

    loadPerformanceData()
  }, [supabase, dateRange, patterns])

  // Calculate metrics
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

  // Time series data
  const timeSeriesData = useMemo(() => {
    if (performanceData.length === 0) return { conversionValue: [] }

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
        acc[key] = { conversion_value: 0, spend: 0 }
      }
      acc[key].conversion_value += record.conversion_value
      acc[key].spend += record.spend
      return acc
    }, {} as Record<string, { conversion_value: number; spend: number }>)

    const sortedKeys = Object.keys(grouped).sort()

    return {
      conversionValue: sortedKeys.map((date) => ({
        date: granularity === 'monthly' ? format(parseISO(date + '-01'), 'MMM yyyy') : format(parseISO(date), 'MMM d'),
        value: grouped[date].conversion_value,
      })),
    }
  }, [performanceData, granularity])

  // Platform breakdown
  const platformBreakdown = useMemo(() => {
    const grouped = performanceData.reduce((acc, record) => {
      if (!acc[record.platform]) {
        acc[record.platform] = 0
      }
      acc[record.platform] += record.conversion_value
      return acc
    }, {} as Record<Platform, number>)

    return Object.entries(grouped).map(([platform, value]) => ({
      platform: platform as Platform,
      value,
    }))
  }, [performanceData])

  // Unique ads
  const uniqueAds = useMemo(() => {
    const adMap = new Map<string, AdPerformance & { totalConversionValue: number; totalSpend: number }>()

    performanceData.forEach((record) => {
      const key = `${record.ad_name}-${record.platform}`
      if (!adMap.has(key)) {
        adMap.set(key, {
          ...record,
          totalConversionValue: record.conversion_value,
          totalSpend: record.spend,
        })
      } else {
        const existing = adMap.get(key)!
        existing.totalConversionValue += record.conversion_value
        existing.totalSpend += record.spend
      }
    })

    return Array.from(adMap.values())
  }, [performanceData])

  // Partner sports (derived from matched ads)
  const partnerSports = useMemo(() => {
    const sportIds = [...new Set(performanceData.map((ad) => ad.sport_id).filter(Boolean))]
    return sports.filter((s) => sportIds.includes(s.id))
  }, [performanceData, sports])

  // Partner status
  const status = useMemo(() => {
    if (!partner) return 'prospect'
    return getPartnerStatus(partner.contract_start_date, partner.contract_end_date)
  }, [partner])

  // Video count for this partner
  const videoCount = useMemo(() => {
    if (!partner) return 0
    return videos.filter(v => v.creator_id === partner.converted_from_creator_id).length
  }, [partner, videos])

  // Months in date range
  const monthsInRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 1
    return calculateMonthsInRange(dateRange.from, dateRange.to)
  }, [dateRange])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await supabase.from('partners').delete().eq('id', partnerId)
      router.push('/partners')
    } catch (err) {
      console.error('Failed to delete partner:', err)
    } finally {
      setDeleting(false)
    }
  }

  const dateRangeLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'All time'

  if (!partner && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Partner not found</h2>
        <Button asChild className="mt-4">
          <Link href="/partners">Back to Partners</Link>
        </Button>
      </div>
    )
  }

  const statusBadge = STATUS_BADGES[status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {loading && !partner ? (
            <>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{partner?.name}</h1>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </div>
              <p className="text-muted-foreground">@{partner?.handle}</p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/partners/${partnerId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Partner</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {partner?.name}? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Profile Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Rate</p>
              <p className="text-sm font-medium">
                {formatCurrency(partner?.rate || 0)} / {partner?.rate_type === 'per_video' ? 'video' : 'month'}
              </p>
            </div>
            {partner?.contract_start_date && (
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(partner.contract_start_date), 'MMM d, yyyy')}
                </p>
              </div>
            )}
            {partner?.contract_end_date && (
              <div>
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(partner.contract_end_date), 'MMM d, yyyy')}
                </p>
              </div>
            )}
            {!partner?.contract_start_date && !partner?.contract_end_date && (
              <p className="text-sm text-muted-foreground">No contract dates set</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {partner?.email && (
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${partner.email}`} className="text-sm text-primary hover:underline">
                  {partner.email}
                </a>
              </div>
            )}
            {partner?.phone_number && (
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <a href={`tel:${partner.phone_number}`} className="text-sm text-primary hover:underline">
                  {partner.phone_number}
                </a>
              </div>
            )}
            {!partner?.email && !partner?.phone_number && (
              <p className="text-sm text-muted-foreground">No contact info</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {partner?.social_links && Object.entries(partner.social_links).length > 0 ? (
              Object.entries(partner.social_links)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline capitalize"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {platform}
                  </a>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">No social links</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {partner?.payout_method ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="text-sm font-medium capitalize">
                    {partner.payout_method === 'sidelineswap' ? 'SidelineSwap' : partner.payout_method}
                  </p>
                </div>
                {partner.payout_username && (
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-medium">{partner.payout_username}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No payout method set</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes and Sports */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sports</CardTitle>
          </CardHeader>
          <CardContent>
            {partnerSports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {partnerSports.map((sport) => (
                  <Badge key={sport.id} variant="secondary">
                    {sport.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sports (derived from ads)</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {partner?.notes || 'No notes'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Calculator */}
      {partner && (
        <PartnerPayoutCalculator
          rate={partner.rate}
          rateType={partner.rate_type}
          videoCount={videoCount}
          monthsInRange={monthsInRange}
          dateRangeLabel={dateRangeLabel}
        />
      )}

      {/* Date Range and Granularity */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance</h2>
        <div className="flex items-center gap-4">
          <GranularityToggle value={granularity} onChange={setGranularity} />
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="GMV"
          value={formatCurrency(metrics.gmv)}
          loading={loading}
        />
        <MetricCard
          title="Revenue"
          value={formatCurrency(metrics.revenue)}
          loading={loading}
        />
        <MetricCard
          title="ROAS"
          value={`${metrics.roas.toFixed(2)}x`}
          loading={loading}
        />
        <MetricCard
          title="Conversions"
          value={formatCompactNumber(metrics.conversions)}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          title="Conversion Value Over Time"
          data={timeSeriesData.conversionValue}
          formatValue="currency"
          color="var(--chart-2)"
          loading={loading}
        />
        <PlatformBreakdownChart
          title="GMV by Platform"
          data={platformBreakdown}
          loading={loading}
        />
      </div>

      {/* Matched Ads */}
      <Card>
        <CardHeader>
          <CardTitle>Matched Ads ({uniqueAds.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Name</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead className="text-right">GMV</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueAds.slice(0, 20).map((ad, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {ad.ad_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {ad.platform}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sports.find((s) => s.id === ad.sport_id)?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(ad.totalConversionValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(ad.totalSpend)}
                    </TableCell>
                    <TableCell>
                      {ad.creative_url ? (
                        <a
                          href={ad.creative_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {uniqueAds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No matching ads found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
