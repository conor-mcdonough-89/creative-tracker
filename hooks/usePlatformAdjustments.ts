'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setPlatformDiscounts } from '@/lib/calculations'
import type { PlatformAdjustment, Platform } from '@/lib/types'

export function usePlatformAdjustments() {
  const [loaded, setLoaded] = useState(false)
  const [adjustments, setAdjustments] = useState<Record<Platform, number>>({
    meta: 0.50,
    tiktok: 0,
    google: 0,
  })

  const supabase = createClient()

  useEffect(() => {
    const loadAdjustments = async () => {
      const { data, error } = await supabase
        .from('platform_adjustments')
        .select('*')

      if (data && !error) {
        const discounts: Record<string, number> = {}
        for (const adj of data as PlatformAdjustment[]) {
          discounts[adj.platform] = adj.conversion_discount
        }
        setPlatformDiscounts(discounts)
        setAdjustments({
          meta: discounts.meta ?? 0.50,
          tiktok: discounts.tiktok ?? 0,
          google: discounts.google ?? 0,
        })
      }
      setLoaded(true)
    }

    loadAdjustments()
  }, [supabase])

  return { loaded, adjustments }
}
