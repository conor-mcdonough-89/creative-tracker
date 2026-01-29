'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus, TestTube } from 'lucide-react'
import type { Partner, PartnerPattern, PayoutMethod, PartnerRateType } from '@/lib/types'

const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'gusto', label: 'Gusto' },
  { value: 'sidelineswap', label: 'SidelineSwap' },
  { value: 'zelle', label: 'Zelle' },
]

const RATE_TYPES: { value: PartnerRateType; label: string }[] = [
  { value: 'per_video', label: 'Per Video' },
  { value: 'per_month', label: 'Per Month' },
]

interface PartnerFormProps {
  partner?: Partner & { patterns?: PartnerPattern[] }
  mode: 'create' | 'edit'
  initialData?: {
    name?: string
    handle?: string
    patterns?: string[]
    socialLinks?: Record<string, string>
    payoutMethod?: PayoutMethod | null
    payoutUsername?: string
    notes?: string
  }
}

export function PartnerForm({ partner, mode, initialData }: PartnerFormProps) {
  const [name, setName] = useState(partner?.name || initialData?.name || '')
  const [handle, setHandle] = useState(partner?.handle || initialData?.handle || '')
  const [patterns, setPatterns] = useState<string[]>(
    partner?.patterns?.map((p) => p.pattern) || initialData?.patterns || []
  )
  const [newPattern, setNewPattern] = useState('')
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    (partner?.social_links as Record<string, string>) || initialData?.socialLinks || {}
  )
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | null>(
    partner?.payout_method || initialData?.payoutMethod || null
  )
  const [payoutUsername, setPayoutUsername] = useState(
    partner?.payout_username || initialData?.payoutUsername || ''
  )
  const [rate, setRate] = useState(partner?.rate?.toString() || '')
  const [rateType, setRateType] = useState<PartnerRateType>(
    partner?.rate_type || 'per_video'
  )
  const [contractStartDate, setContractStartDate] = useState(
    partner?.contract_start_date || ''
  )
  const [contractEndDate, setContractEndDate] = useState(
    partner?.contract_end_date || ''
  )
  const [contactInfo, setContactInfo] = useState(partner?.contact_info || '')
  const [notes, setNotes] = useState(partner?.notes || initialData?.notes || '')
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
      const rateValue = parseFloat(rate) || 0

      if (mode === 'create') {
        // Create partner
        const { data: partnerData, error: createError } = await supabase
          .from('partners')
          .insert({
            name,
            handle,
            social_links: socialLinks,
            payout_method: payoutMethod,
            payout_username: payoutUsername || null,
            rate: rateValue,
            rate_type: rateType,
            contract_start_date: contractStartDate || null,
            contract_end_date: contractEndDate || null,
            contact_info: contactInfo || null,
            notes: notes || null,
          })
          .select()
          .single()

        if (createError) throw createError

        // Create patterns
        if (patterns.length > 0) {
          const { error: patternsError } = await supabase
            .from('partner_patterns')
            .insert(
              patterns.map((pattern) => ({
                partner_id: partnerData.id,
                pattern,
              }))
            )

          if (patternsError) throw patternsError
        }

        router.push(`/partners/${partnerData.id}`)
      } else if (partner) {
        // Update partner
        const { error: updateError } = await supabase
          .from('partners')
          .update({
            name,
            handle,
            social_links: socialLinks,
            payout_method: payoutMethod,
            payout_username: payoutUsername || null,
            rate: rateValue,
            rate_type: rateType,
            contract_start_date: contractStartDate || null,
            contract_end_date: contractEndDate || null,
            contact_info: contactInfo || null,
            notes: notes || null,
          })
          .eq('id', partner.id)

        if (updateError) throw updateError

        // Delete existing patterns and recreate
        await supabase
          .from('partner_patterns')
          .delete()
          .eq('partner_id', partner.id)

        if (patterns.length > 0) {
          const { error: patternsError } = await supabase
            .from('partner_patterns')
            .insert(
              patterns.map((pattern) => ({
                partner_id: partner.id,
                pattern,
              }))
            )

          if (patternsError) throw patternsError
        }

        router.push(`/partners/${partner.id}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save partner')
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
            Partner&apos;s display name and social handle
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
            Patterns to match this partner&apos;s ads. Ads containing any of these patterns (case-insensitive) will be attributed to this partner.
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
          <CardTitle>Contract Details</CardTitle>
          <CardDescription>
            Rate and contract period for this partner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rate">Rate ($)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="100.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate_type">Rate Type</Label>
              <Select
                value={rateType}
                onValueChange={(value) => setRateType(value as PartnerRateType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rate type..." />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contract_start">Contract Start Date</Label>
              <Input
                id="contract_start"
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contract_end">Contract End Date</Label>
              <Input
                id="contract_end"
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>
            How to reach this partner (email, phone, address, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="Email: partner@example.com&#10;Phone: (555) 123-4567"
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>
            Partner&apos;s social media profiles (optional)
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
          <CardTitle>Payout Information</CardTitle>
          <CardDescription>
            How to pay this partner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="payout_method">Payout Method</Label>
            <Select
              value={payoutMethod || ''}
              onValueChange={(value) => setPayoutMethod(value as PayoutMethod)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payout method..." />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payout_username">Payout Username</Label>
            <Input
              id="payout_username"
              value={payoutUsername}
              onChange={(e) => setPayoutUsername(e.target.value)}
              placeholder="@username or email"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Internal notes about this partner
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this partner..."
            rows={4}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : mode === 'create' ? 'Create Partner' : 'Save Changes'}
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
