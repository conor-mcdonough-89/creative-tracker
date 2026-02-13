'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PartnerForm } from '@/components/partners/PartnerForm'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { Partner, PartnerPattern } from '@/lib/types'

export default function EditPartnerPage() {
  const params = useParams()
  const partnerId = params.id as string

  const [partner, setPartner] = useState<(Partner & { patterns?: PartnerPattern[] }) | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const loadPartner = async () => {
      const [partnerRes, patternsRes] = await Promise.all([
        supabase.from('partners').select('*').eq('id', partnerId).single(),
        supabase.from('partner_patterns').select('*').eq('partner_id', partnerId),
      ])

      if (partnerRes.data) {
        setPartner({
          ...(partnerRes.data as Partner),
          patterns: (patternsRes.data as PartnerPattern[]) || [],
        })
      }
      setLoading(false)
    }
    loadPartner()
  }, [supabase, partnerId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Partner not found</h2>
        <Button asChild className="mt-4">
          <Link href="/partners">Back to Partners</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Partner</h1>
        <p className="text-muted-foreground">
          Update {partner.name}&apos;s profile and contract details
        </p>
      </div>

      <div className="max-w-2xl">
        <PartnerForm partner={partner} mode="edit" />
      </div>
    </div>
  )
}
