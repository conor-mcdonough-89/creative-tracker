'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
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
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { useDateRange } from '@/lib/date-context'
import { GranularityToggle } from '@/components/dashboard/GranularityToggle'
import { TimeSeriesChart } from '@/components/dashboard/TimeSeriesChart'
import { PlatformBreakdownChart } from '@/components/dashboard/PlatformBreakdownChart'
import { PayoutCalculator } from '@/components/creators/PayoutCalculator'
import {
  formatCurrency,
  formatCompactNumber,
  aggregatePerformance,
} from '@/lib/calculations'
import { Edit, Trash2, ExternalLink, UserPlus } from 'lucide-react'
import type { Creator, CreatorPattern, AdPerformance, Sport, Platform, Granularity } from '@/lib/types'
import { parseISO, startOfWeek, startOfMonth } from 'date-fns'

export default function CreatorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const creatorId = params.id as string

  const { dateRange, setDateRange } = useDateRange()
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const [creator, setCreator] = useState<Creator | null>(null)
  const [patterns, setPatterns] = useState<CreatorPattern[]>([])
  const [performanceData, setPerformanceData] = useState<AdPerformance[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [converting, setConverting] = useState(false)

  const supabase = createClient()

  // Load creator and patterns
  useEffect(() => {
    const loadCreator = async () => {
      const [creatorRes, patternsRes, sportsRes] = await Promise.all([
        supabase.from('creators').select('*').eq('id', creatorId).single(),
        supabase.from('creator_patterns').select('*').eq('creator_id', creatorId),
        supabase.from('sports').select('*').order('name'),
      ])

      if (creatorRes.data) setCreator(creatorRes.data as Creator)
      if (patternsRes.data) setPatterns(patternsRes.data as CreatorPattern[])
      if (sportsRes.data) setSports(sportsRes.data as Sport[])
    }
    loadCreator()
  }, [supabase, creatorId])

  // Load performance data (use ads_with_creators view for proper matching)
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!dateRange?.from || !dateRange?.to || !creatorId) {
        setLoading(false)
        return
      }

      setLoading(true)

      // Query ads matched to this creator via the view
      const { data, error } = await supabase
        .from('ads_with_creators')
        .select('*')
        .eq('creator_id', creatorId)
        .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('date', { ascending: false })

      if (data && !error) {
        setPerformanceData(data as AdPerformance[])
      }
      setLoading(false)
    }

    loadPerformanceData()
  }, [supabase, dateRange, creatorId])

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

  // Creator sports (derived from matched ads)
  const creatorSports = useMemo(() => {
    const sportIds = [...new Set(performanceData.map((ad) => ad.sport_id).filter(Boolean))]
    return sports.filter((s) => sportIds.includes(s.id))
  }, [performanceData, sports])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await supabase.from('creators').delete().eq('id', creatorId)
      router.push('/creators')
    } catch (err) {
      console.error('Failed to delete creator:', err)
    } finally {
      setDeleting(false)
    }
  }

  const handleConvertToPartner = async () => {
    if (!creator) return
    setConverting(true)
    try {
      // Create partner from creator data
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .insert({
          name: creator.name,
          handle: creator.handle,
          social_links: creator.social_links,
          payout_method: creator.payout_method,
          payout_username: creator.payout_username,
          notes: creator.notes,
          rate: 0, // Default rate, user will set in edit
          rate_type: 'per_video',
          converted_from_creator_id: creator.id,
        })
        .select()
        .single()

      if (partnerError) throw partnerError

      // Copy patterns to partner_patterns
      if (patterns.length > 0) {
        const { error: patternsError } = await supabase
          .from('partner_patterns')
          .insert(
            patterns.map((pattern) => ({
              partner_id: partnerData.id,
              pattern: pattern.pattern,
            }))
          )

        if (patternsError) throw patternsError
      }

      // Navigate to the new partner's edit page to set rate and contract details
      router.push(`/partners/${partnerData.id}/edit`)
    } catch (err) {
      console.error('Failed to convert to partner:', err)
    } finally {
      setConverting(false)
    }
  }

  const dateRangeLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`
    : 'All time'

  if (!creator && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Creator not found</h2>
        <Button asChild className="mt-4">
          <Link href="/creators">Back to Creators</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {loading && !creator ? (
            <>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{creator?.name}</h1>
              <p className="text-muted-foreground">@{creator?.handle}</p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Convert to Partner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convert to Partner</DialogTitle>
                <DialogDescription>
                  This will create a new Partner record from {creator?.name}&apos;s data. You&apos;ll be able to set the rate and contract details on the next page. The original Creator record will remain unchanged.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConvertToPartner} disabled={converting}>
                  {converting ? 'Converting...' : 'Convert to Partner'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" asChild>
            <Link href={`/creators/${creatorId}/edit`}>
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
                <DialogTitle>Delete Creator</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {creator?.name}? This action cannot be undone.
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
            <CardTitle className="text-base">Social Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {creator?.social_links && Object.entries(creator.social_links).length > 0 ? (
              Object.entries(creator.social_links)
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
            {creator?.payout_method ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Method</p>
                  <p className="text-sm font-medium capitalize">
                    {creator.payout_method === 'sidelineswap' ? 'SidelineSwap' : creator.payout_method}
                  </p>
                </div>
                {creator.payout_username && (
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-medium">{creator.payout_username}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No payout method set</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sports</CardTitle>
          </CardHeader>
          <CardContent>
            {creatorSports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {creatorSports.map((sport) => (
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
              {creator?.notes || 'No notes'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Calculator */}
      <PayoutCalculator gmv={metrics.gmv} dateRangeLabel={dateRangeLabel} />

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
