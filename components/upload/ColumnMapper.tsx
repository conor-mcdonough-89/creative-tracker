'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CANONICAL_FIELDS, type CanonicalField } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface ColumnMapperProps {
  csvColumns: string[]
  mappings: Record<string, string>
  onMappingChange: (canonicalField: CanonicalField, csvColumn: string) => void
}

const FIELD_DESCRIPTIONS: Record<CanonicalField, { label: string; required: boolean; description: string }> = {
  ad_name: { label: 'Ad Name', required: true, description: 'Creative/ad name identifier' },
  campaign_name: { label: 'Campaign Name', required: false, description: 'Campaign name (used to detect sport)' },
  date: { label: 'Date', required: true, description: 'Performance date (YYYY-MM-DD)' },
  impressions: { label: 'Impressions', required: true, description: 'Total impressions' },
  clicks: { label: 'Clicks', required: true, description: 'Total clicks' },
  spend: { label: 'Spend', required: true, description: 'Amount spent (USD)' },
  conversions: { label: 'Conversions', required: true, description: 'Total conversions' },
  conversion_value: { label: 'Conversion Value', required: true, description: 'Revenue/GMV from conversions (USD)' },
  video_views: { label: 'Video Views', required: false, description: 'Video views (optional)' },
  creative_url: { label: 'Creative URL', required: false, description: 'Link to the creative asset (optional)' },
}

export function ColumnMapper({ csvColumns, mappings, onMappingChange }: ColumnMapperProps) {
  const [autoDetected, setAutoDetected] = useState<Set<CanonicalField>>(new Set())

  // Try to auto-detect mappings based on common column names
  const suggestMapping = (canonicalField: CanonicalField): string | undefined => {
    const patterns: Record<CanonicalField, RegExp[]> = {
      ad_name: [/ad.?name/i, /creative.?name/i, /^name$/i],
      campaign_name: [/campaign.?name/i, /campaign$/i],
      date: [/^date$/i, /day$/i, /report.?date/i],
      impressions: [/impressions?$/i, /imps?$/i],
      clicks: [/clicks?$/i, /link.?clicks?/i],
      spend: [/spend$/i, /cost$/i, /amount.?spent/i],
      conversions: [/conversions?$/i, /purchase/i, /results?$/i],
      conversion_value: [/conversion.?value/i, /revenue/i, /value$/i, /purchase.?value/i, /gmv/i],
      video_views: [/video.?views?/i, /views?$/i, /3s.?views?/i],
      creative_url: [/creative.?url/i, /url$/i, /link$/i, /preview/i],
    }

    for (const column of csvColumns) {
      for (const pattern of patterns[canonicalField]) {
        if (pattern.test(column)) {
          return column
        }
      }
    }
    return undefined
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {CANONICAL_FIELDS.map((field) => {
          const info = FIELD_DESCRIPTIONS[field]
          const suggestedValue = suggestMapping(field)
          const currentValue = mappings[field] || ''

          return (
            <div key={field} className="grid grid-cols-3 items-center gap-4">
              <div>
                <Label htmlFor={field} className="flex items-center gap-2">
                  {info.label}
                  {info.required ? (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Optional</Badge>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </div>
              <div className="col-span-2">
                <Select
                  value={currentValue}
                  onValueChange={(value) => onMappingChange(field, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={suggestedValue ? `Suggested: ${suggestedValue}` : 'Select column...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Skip this field --</SelectItem>
                    {csvColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                        {suggestedValue === column && (
                          <span className="ml-2 text-muted-foreground">(suggested)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
