'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, X, CheckCircle2, Trash2, RefreshCw, Link2 } from 'lucide-react'
import { ManualLinkDialog } from './ManualLinkDialog'
import type { Platform } from '@/lib/types'

interface UnmappedAd {
  ad_name: string
  platform: Platform
  first_seen: string
  is_now_mapped: boolean
}

export function UnmappedAdsSection() {
  const [unmappedAds, setUnmappedAds] = useState<UnmappedAd[]>([])
  const [dismissedAds, setDismissedAds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<string | null>(null)
  const [linkingAd, setLinkingAd] = useState<string | null>(null)

  const supabase = createClient()

  const loadUnmappedAds = async () => {
    setLoading(true)

    // Get all dismissed ad names
    const { data: dismissed } = await supabase
      .from('dismissed_unmapped_ads')
      .select('ad_name')

    const dismissedSet = new Set((dismissed || []).map((d) => d.ad_name))
    setDismissedAds(dismissedSet)

    // Get all unique ads with their first import date
    const { data: allAds } = await supabase
      .from('ad_performance')
      .select('ad_name, platform, created_at')
      .order('created_at', { ascending: true })

    if (!allAds) {
      setLoading(false)
      return
    }

    // Get unique ads with first seen date
    const adMap = new Map<string, { platform: Platform; first_seen: string }>()
    for (const ad of allAds) {
      if (!adMap.has(ad.ad_name)) {
        adMap.set(ad.ad_name, {
          platform: ad.platform as Platform,
          first_seen: ad.created_at,
        })
      }
    }

    // Get all ads that are currently mapped via ads_with_creators
    const { data: mappedAds } = await supabase
      .from('ads_with_creators')
      .select('ad_name, creator_id')

    const mappedAdNames = new Set(
      (mappedAds || [])
        .filter((a) => a.creator_id !== null)
        .map((a) => a.ad_name)
    )

    // Build the unmapped ads list
    const unmapped: UnmappedAd[] = []
    for (const [ad_name, info] of adMap) {
      // Skip if dismissed
      if (dismissedSet.has(ad_name)) continue

      const isMapped = mappedAdNames.has(ad_name)

      // Include if not mapped OR if now mapped (to show retroactive matches)
      if (!isMapped) {
        unmapped.push({
          ad_name,
          platform: info.platform,
          first_seen: info.first_seen,
          is_now_mapped: false,
        })
      }
    }

    // Also check previously unmapped that are now mapped
    // We need to track this separately - for now, just show truly unmapped
    setUnmappedAds(unmapped)
    setLoading(false)
  }

  useEffect(() => {
    loadUnmappedAds()
  }, [])

  const handleDismiss = async (adName: string) => {
    setDismissing(adName)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('dismissed_unmapped_ads')
      .insert({
        ad_name: adName,
        dismissed_by: user?.email || null,
      })

    if (!error) {
      setUnmappedAds((prev) => prev.filter((a) => a.ad_name !== adName))
      setDismissedAds((prev) => new Set([...prev, adName]))
    }

    setDismissing(null)
  }

  const handleDismissAll = async () => {
    if (unmappedAds.length === 0) return

    setDismissing('all')

    const { data: { user } } = await supabase.auth.getUser()

    const records = unmappedAds.map((ad) => ({
      ad_name: ad.ad_name,
      dismissed_by: user?.email || null,
    }))

    const { error } = await supabase
      .from('dismissed_unmapped_ads')
      .upsert(records, { onConflict: 'ad_name' })

    if (!error) {
      const newDismissed = new Set([
        ...dismissedAds,
        ...unmappedAds.map((a) => a.ad_name),
      ])
      setDismissedAds(newDismissed)
      setUnmappedAds([])
    }

    setDismissing(null)
  }

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
      // Remove from unmapped list since it's now linked
      setUnmappedAds((prev) => prev.filter((a) => a.ad_name !== linkingAd))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const platformColors: Record<Platform, string> = {
    meta: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    tiktok: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    google: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Unmapped Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (unmappedAds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Unmapped Ads
          </CardTitle>
          <CardDescription>
            All ads are mapped to creators or have been dismissed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={loadUnmappedAds}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unmapped Ads
              <Badge variant="secondary">{unmappedAds.length}</Badge>
            </CardTitle>
            <CardDescription>
              Ads that haven&apos;t been matched to any creator. Dismiss to hide from this list.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadUnmappedAds}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismissAll}
              disabled={dismissing === 'all'}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {dismissing === 'all' ? 'Dismissing...' : 'Dismiss All'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Ad Name</th>
                <th className="text-left px-4 py-2 font-medium w-24">Platform</th>
                <th className="text-left px-4 py-2 font-medium w-32">First Seen</th>
                <th className="text-right px-4 py-2 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {unmappedAds.map((ad) => (
                <tr key={ad.ad_name} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs break-all">
                    {ad.is_now_mapped && (
                      <Badge variant="outline" className="mr-2 text-green-600 border-green-600">
                        Now Mapped
                      </Badge>
                    )}
                    {ad.ad_name}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className={platformColors[ad.platform]}>
                      {ad.platform}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDate(ad.first_seen)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLinkingAd(ad.ad_name)}
                        title="Link to creator"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(ad.ad_name)}
                        disabled={dismissing === ad.ad_name}
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Manual Link Dialog */}
        <ManualLinkDialog
          open={linkingAd !== null}
          onOpenChange={(open) => !open && setLinkingAd(null)}
          adName={linkingAd || ''}
          onLink={handleManualLink}
        />
      </CardContent>
    </Card>
  )
}
