'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Plus, TestTube } from 'lucide-react'
import type { Creator, CreatorPattern } from '@/lib/types'

interface CreatorFormProps {
  creator?: Creator & { patterns?: CreatorPattern[] }
  mode: 'create' | 'edit'
}

export function CreatorForm({ creator, mode }: CreatorFormProps) {
  const [name, setName] = useState(creator?.name || '')
  const [handle, setHandle] = useState(creator?.handle || '')
  const [patterns, setPatterns] = useState<string[]>(
    creator?.patterns?.map((p) => p.pattern) || []
  )
  const [newPattern, setNewPattern] = useState('')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    (creator?.social_links as Record<string, string>) || {}
  )
  const [notes, setNotes] = useState(creator?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{ pattern: string; count: number } | null>(null)
  const [testing, setTesting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleAddPattern = () => {
    if (newPattern.trim() && !patterns.includes(newPattern.trim())) {
      setPatterns([...patterns, newPattern.trim()])
      setNewPattern('')
    }
  }

  const handleRemovePattern = (pattern: string) => {
    setPatterns(patterns.filter((p) => p !== pattern))
  }

  const handleTestPattern = async (pattern: string) => {
    setTesting(true)
    setTestResults(null)

    try {
      // Count matching ads
      const { count, error } = await supabase
        .from('ad_performance')
        .select('ad_name', { count: 'exact', head: true })
        .ilike('ad_name', `%${pattern}%`)

      if (error) throw error

      setTestResults({ pattern, count: count || 0 })
    } catch (err) {
      setError('Failed to test pattern')
    } finally {
      setTesting(false)
    }
  }

  const handleSocialLinkChange = (platform: string, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      if (mode === 'create') {
        // Create creator
        const { data: creatorData, error: createError } = await supabase
          .from('creators')
          .insert({
            name,
            handle,
            social_links: socialLinks,
            notes: notes || null,
          })
          .select()
          .single()

        if (createError) throw createError

        // Create patterns
        if (patterns.length > 0) {
          const { error: patternsError } = await supabase
            .from('creator_patterns')
            .insert(
              patterns.map((pattern) => ({
                creator_id: creatorData.id,
                pattern,
              }))
            )

          if (patternsError) throw patternsError
        }

        router.push(`/creators/${creatorData.id}`)
      } else if (creator) {
        // Update creator
        const { error: updateError } = await supabase
          .from('creators')
          .update({
            name,
            handle,
            social_links: socialLinks,
            notes: notes || null,
          })
          .eq('id', creator.id)

        if (updateError) throw updateError

        // Delete existing patterns and recreate
        await supabase
          .from('creator_patterns')
          .delete()
          .eq('creator_id', creator.id)

        if (patterns.length > 0) {
          const { error: patternsError } = await supabase
            .from('creator_patterns')
            .insert(
              patterns.map((pattern) => ({
                creator_id: creator.id,
                pattern,
              }))
            )

          if (patternsError) throw patternsError
        }

        router.push(`/creators/${creator.id}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save creator')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
          <CardDescription>
            Creator&apos;s display name and social handle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jessica Smith"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="handle">Handle</Label>
            <div className="flex items-center">
              <span className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted px-3 text-muted-foreground">
                @
              </span>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="jessicasmith"
                className="rounded-l-none"
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matching Patterns</CardTitle>
          <CardDescription>
            Patterns to match this creator&apos;s ads. Ads containing any of these patterns (case-insensitive) will be attributed to this creator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="e.g., jessicasmith or jessica_baseball"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddPattern()
                }
              }}
            />
            <Button type="button" onClick={handleAddPattern}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {patterns.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {patterns.map((pattern) => (
                <Badge
                  key={pattern}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {pattern}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => handleRemovePattern(pattern)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => handleTestPattern(pattern)}
                    disabled={testing}
                  >
                    <TestTube className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {testResults && (
            <div className="rounded-md bg-muted p-3 text-sm">
              Pattern &quot;{testResults.pattern}&quot; matches{' '}
              <strong>{testResults.count}</strong> unique ad entries
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>
            Creator&apos;s social media profiles (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {['tiktok', 'instagram', 'youtube', 'twitter'].map((platform) => (
            <div key={platform} className="grid gap-2">
              <Label htmlFor={platform} className="capitalize">
                {platform}
              </Label>
              <Input
                id={platform}
                value={socialLinks[platform] || ''}
                onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                placeholder={`https://${platform}.com/...`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Internal notes about this creator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this creator..."
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : mode === 'create' ? 'Create Creator' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
