'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Lock, Save } from 'lucide-react'
import { ADMIN_EMAIL } from '@/lib/calculations'
import type { Platform, PlatformAdjustment } from '@/lib/types'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google Ads' },
]

export default function AdjustmentsPage() {
  // Store multiplier directly (0.5 = 50% of value, 1.3 = 130% of value)
  const [adjustments, setAdjustments] = useState<Record<Platform, number>>({
    meta: 0.50,
    tiktok: 1.0,
    google: 1.0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()
  const isAdmin = userEmail === ADMIN_EMAIL

  useEffect(() => {
    const loadData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email ?? null)

      // Load current adjustments
      const { data, error } = await supabase
        .from('platform_adjustments')
        .select('*')

      if (data && !error) {
        const loaded: Record<Platform, number> = {
          meta: 0.50,
          tiktok: 1.0,
          google: 1.0,
        }
        for (const adj of data as PlatformAdjustment[]) {
          // conversion_discount now stores the multiplier directly
          loaded[adj.platform] = adj.conversion_discount
        }
        setAdjustments(loaded)
      }

      setLoading(false)
    }

    loadData()
  }, [supabase])

  const handleChange = (platform: Platform, value: string) => {
    const numValue = parseFloat(value) / 100 // Convert percentage to decimal multiplier
    if (!isNaN(numValue) && numValue >= 0) {
      setAdjustments((prev) => ({
        ...prev,
        [platform]: numValue,
      }))
    }
  }

  const handleSave = async () => {
    if (!isAdmin) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      for (const platform of PLATFORMS) {
        // Use upsert to handle both insert and update cases
        const { error } = await supabase
          .from('platform_adjustments')
          .upsert({
            platform: platform.value,
            conversion_discount: adjustments[platform.value],
            updated_by: userEmail,
          }, {
            onConflict: 'platform',
          })

        if (error) throw error
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save adjustments')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Adjustments</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Adjustments</h1>
          <p className="text-muted-foreground">
            Configure platform-specific conversion adjustments
          </p>
        </div>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Access Restricted</p>
              <p className="text-sm text-muted-foreground">
                This settings page is only accessible to administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Adjustments</h1>
        <p className="text-muted-foreground">
          Configure platform-specific conversion adjustments
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-500">
          <CardContent className="flex items-center gap-2 pt-6 text-green-600">
            <Save className="h-5 w-5" />
            Adjustments saved successfully
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conversion Multipliers</CardTitle>
          <CardDescription>
            Set what percentage of each platform&apos;s reported conversions and conversion value to use.
            For example: 50% means values are halved (under-counting), 130% means values are boosted by 30%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PLATFORMS.map((platform) => (
            <div key={platform.value} className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={platform.value} className="text-base">
                {platform.label}
              </Label>
              <div className="col-span-2 flex items-center gap-2">
                <Input
                  id={platform.value}
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  value={Math.round(adjustments[platform.value] * 100)}
                  onChange={(e) => handleChange(platform.value, e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">% of reported</span>
                <span className="ml-4 text-sm text-muted-foreground">
                  (multiplier: {adjustments[platform.value].toFixed(2)})
                </span>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Adjustments'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>100%:</strong> No adjustment - use reported values as-is.
            </li>
            <li>
              <strong>50%:</strong> Discount - if Meta reports $10,000, dashboard shows $5,000.
            </li>
            <li>
              <strong>130%:</strong> Boost - if TikTok reports $10,000, dashboard shows $13,000.
            </li>
            <li>
              <strong>Affects:</strong> GMV, Revenue, Payouts, and ROAS calculations across all dashboards.
            </li>
            <li>
              <strong>Raw Data:</strong> The original values are preserved in the database; adjustments are applied only during display calculations.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
