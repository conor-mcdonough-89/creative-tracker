'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { useDateRange } from '@/lib/date-context'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { usePlatformAdjustments } from '@/hooks/usePlatformAdjustments'
import { formatCurrency, formatCompactNumber } from '@/lib/calculations'
import { ManualLinkDialog } from '@/components/upload/ManualLinkDialog'
import { Search, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Link2 } from 'lucide-react'
import type { Platform, Sport, Creator, CreatorPattern, AdWithRelations } from '@/lib/types'

interface AggregatedAd {
  ad_name: string
  platform: Platform
  sport_id: string | null
  sport_name: string | null
  creator_id: string | null
  creator_name: string | null
  creative_url: string | null
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  roas: number
}

export default function AdsPage() {
  const { dateRange, setDateRange } = useDateRange()
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [selectedCreators, setSelectedCreators] = useState<string[]>([])
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('conversion_value')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const [sports, setSports] = useState<Sport[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [patterns, setPatterns] = useState<CreatorPattern[]>([])
  const [performanceData, setPerformanceData] = useState<AdWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [linkingAd, setLinkingAd] = useState<string | null>(null)

  const supabase = createClient()

  // Load platform adjustments for consistent metrics
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

  // Load performance data
  // Paginate to fetch all rows (Supabase defaults to 1000 row limit)
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!dateRange?.from || !dateRange?.to) return

      setLoading(true)

      const pageSize = 1000
      let allData: AdWithRelations[] = []
      let from = 0
      let hasMore = true

      while (hasMore) {
        // Query the view that includes pre-calculated platform adjustments
        let query = supabase
          .from('ads_with_creators')
          .select('*')
          .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
          .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
          .order('date', { ascending: false })
          .range(from, from + pageSize - 1)

        if (selectedPlatforms.length > 0) {
          query = query.in('platform', selectedPlatforms)
        }

        if (selectedSports.length > 0) {
          query = query.in('sport_id', selectedSports)
        }

        const { data, error } = await query

        if (data && !error) {
          allData = [...allData, ...(data as AdWithRelations[])]
          hasMore = data.length === pageSize
        } else {
          hasMore = false
        }
        from += pageSize
      }

      setPerformanceData(allData)
      setLoading(false)
    }

    loadPerformanceData()
  }, [supabase, dateRange, selectedPlatforms, selectedSports])

  // Handle manual linking
  const handleManualLink = async (creatorId: string, creatorName: string) => {
    if (!linkingAd) return

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('manual_ad_links')
      .insert({
        ad_name: linkingAd,
        creator_id: creatorId,
        linked_by: user?.email || null,
      })

    if (!error) {
      // Refresh the data to show the new mapping
      const query = supabase
        .from('ads_with_creators')
        .select('*')
        .gte('date', format(dateRange!.from!, 'yyyy-MM-dd'))
        .lte('date', format(dateRange!.to!, 'yyyy-MM-dd'))

      const { data } = await query.order('date', { ascending: false })
      if (data) {
        setPerformanceData(data as AdWithRelations[])
      }
    }
  }

  // Aggregate ads (view already provides creator matching and platform adjustments)
  const aggregatedAds = useMemo((): AggregatedAd[] => {
    const adMap = new Map<string, AdWithRelations[]>()

    // Group by ad_name + platform
    performanceData.forEach((record) => {
      const key = `${record.ad_name}|||${record.platform}`
      if (!adMap.has(key)) {
        adMap.set(key, [])
      }
      adMap.get(key)!.push(record)
    })

    // Aggregate and enrich
    return Array.from(adMap.entries()).map(([key, records]) => {
      const [ad_name, platform] = key.split('|||')
      const firstRecord = records[0]

      // Use creator data from the view (already matched by database)
      // Fall back to pattern matching for any unmatched ads
      let creator_id = firstRecord.creator_id || null
      let creator_name = firstRecord.creator_name || null

      if (!creator_id) {
        for (const pattern of patterns) {
          if (ad_name.toLowerCase().includes(pattern.pattern.toLowerCase())) {
            const creator = creators.find((c) => c.id === pattern.creator_id)
            if (creator) {
              creator_id = creator.id
              creator_name = creator.name
              break
            }
          }
        }
      }

      // Use sport name from view or fall back to lookup
      const sport_name = firstRecord.sport_name || sports.find((s) => s.id === firstRecord.sport_id)?.name || null

      // Aggregate metrics using platform-adjusted values
      const totals = records.reduce(
        (acc, r) => ({
          impressions: acc.impressions + r.impressions,
          clicks: acc.clicks + r.clicks,
          spend: acc.spend + r.spend,
          conversions: acc.conversions + (r.adjusted_conversions ?? r.conversions),
          conversion_value: acc.conversion_value + (r.adjusted_conversion_value ?? r.conversion_value),
        }),
        { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversion_value: 0 }
      )

      return {
        ad_name,
        platform: platform as Platform,
        sport_id: firstRecord.sport_id,
        sport_name,
        creator_id,
        creator_name,
        creative_url: firstRecord.creative_url,
        ...totals,
        roas: totals.spend > 0 ? totals.conversion_value / totals.spend : 0,
      }
    })
  }, [performanceData, patterns, creators, sports])

  // Filter by search, creators, and unassigned
  const filteredAds = useMemo(() => {
    let result = aggregatedAds

    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((ad) =>
        ad.ad_name.toLowerCase().includes(searchLower) ||
        ad.creator_name?.toLowerCase().includes(searchLower) ||
        ad.sport_name?.toLowerCase().includes(searchLower)
      )
    }

    if (showUnassignedOnly) {
      result = result.filter((ad) => !ad.creator_id)
    } else if (selectedCreators.length > 0) {
      result = result.filter(
        (ad) => ad.creator_id && selectedCreators.includes(ad.creator_id)
      )
    }

    return result
  }, [aggregatedAds, search, selectedCreators, showUnassignedOnly])

  // Count unassigned ads
  const unassignedCount = useMemo(() => {
    return aggregatedAds.filter((ad) => !ad.creator_id).length
  }, [aggregatedAds])

  // Sort ads
  const sortedAds = useMemo(() => {
    return [...filteredAds].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortField) {
        case 'ad_name':
          aValue = a.ad_name.toLowerCase()
          bValue = b.ad_name.toLowerCase()
          break
        case 'platform':
          aValue = a.platform
          bValue = b.platform
          break
        case 'creator':
          aValue = a.creator_name?.toLowerCase() || 'zzz'
          bValue = b.creator_name?.toLowerCase() || 'zzz'
          break
        case 'sport':
          aValue = a.sport_name?.toLowerCase() || 'zzz'
          bValue = b.sport_name?.toLowerCase() || 'zzz'
          break
        case 'impressions':
          aValue = a.impressions
          bValue = b.impressions
          break
        case 'clicks':
          aValue = a.clicks
          bValue = b.clicks
          break
        case 'spend':
          aValue = a.spend
          bValue = b.spend
          break
        case 'conversions':
          aValue = a.conversions
          bValue = b.conversions
          break
        case 'conversion_value':
          aValue = a.conversion_value
          bValue = b.conversion_value
          break
        case 'roas':
          aValue = a.roas
          bValue = b.roas
          break
        default:
          aValue = a.conversion_value
          bValue = b.conversion_value
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
  }, [filteredAds, sortField, sortDirection])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  )

  const PLATFORM_COLORS: Record<Platform, string> = {
    meta: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    tiktok: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    google: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ad Creatives</h1>
        <p className="text-muted-foreground">
          Browse and search all ad creatives across platforms
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[300px]"
            />
          </div>
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
          {/* Unassigned filter */}
          <Button
            variant={showUnassignedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}
            className="gap-2"
          >
            Unassigned
            {unassignedCount > 0 && (
              <Badge variant={showUnassignedOnly ? 'secondary' : 'destructive'} className="ml-1">
                {unassignedCount}
              </Badge>
            )}
          </Button>
        </div>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {sortedAds.length} ads
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">
                <SortHeader field="ad_name">Ad Name</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader field="platform">Platform</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader field="creator">Creator</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader field="sport">Sport</SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader field="impressions">Impr.</SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader field="clicks">Clicks</SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader field="spend">Spend</SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader field="conversions">Conv.</SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader field="conversion_value">Conv. Value</SortHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortHeader field="roas">ROAS</SortHeader>
              </TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedAds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No ads found
                </TableCell>
              </TableRow>
            ) : (
              sortedAds.slice(0, 100).map((ad, index) => (
                <TableRow key={`${ad.ad_name}-${ad.platform}-${index}`}>
                  <TableCell className="font-medium max-w-[250px]">
                    <span className="truncate block" title={ad.ad_name}>
                      {ad.ad_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={PLATFORM_COLORS[ad.platform]}>
                      {ad.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ad.creator_id ? (
                      <Link
                        href={`/creators/${ad.creator_id}`}
                        className="text-primary hover:underline"
                      >
                        {ad.creator_name}
                      </Link>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary gap-1 -ml-2"
                        onClick={() => setLinkingAd(ad.ad_name)}
                      >
                        <Link2 className="h-3 w-3" />
                        Unassigned
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    {ad.sport_name || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCompactNumber(ad.impressions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCompactNumber(ad.clicks)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(ad.spend)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCompactNumber(ad.conversions)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(ad.conversion_value)}
                  </TableCell>
                  <TableCell className="text-right">
                    {ad.roas.toFixed(2)}x
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
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {sortedAds.length > 100 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing first 100 results. Use filters to narrow down.
        </p>
      )}

      {/* Manual Link Dialog */}
      <ManualLinkDialog
        open={linkingAd !== null}
        onOpenChange={(open) => !open && setLinkingAd(null)}
        adName={linkingAd || ''}
        onLink={handleManualLink}
      />
    </div>
  )
}
