'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CreatorForm } from '@/components/creators/CreatorForm'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { Creator, CreatorPattern } from '@/lib/types'

export default function EditCreatorPage() {
  const params = useParams()
  const creatorId = params.id as string

  const [creator, setCreator] = useState<(Creator & { patterns?: CreatorPattern[] }) | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const loadCreator = async () => {
      const [creatorRes, patternsRes] = await Promise.all([
        supabase.from('creators').select('*').eq('id', creatorId).single(),
        supabase.from('creator_patterns').select('*').eq('creator_id', creatorId),
      ])

      if (creatorRes.data) {
        setCreator({
          ...(creatorRes.data as Creator),
          patterns: (patternsRes.data as CreatorPattern[]) || [],
        })
      }
      setLoading(false)
    }
    loadCreator()
  }, [supabase, creatorId])

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

  if (!creator) {
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Creator</h1>
        <p className="text-muted-foreground">
          Update {creator.name}&apos;s profile and patterns
        </p>
      </div>

      <div className="max-w-2xl">
        <CreatorForm creator={creator} mode="edit" />
      </div>
    </div>
  )
}
