'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CANONICAL_FIELDS, type CanonicalField } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'

interface DataPreviewProps {
  data: Record<string, string>[]
  mappings: Record<string, string>
  maxRows?: number
}

const FIELD_LABELS: Record<CanonicalField, string> = {
  ad_name: 'Ad Name',
  campaign_name: 'Campaign',
  date: 'Date',
  impressions: 'Impr.',
  clicks: 'Clicks',
  spend: 'Spend',
  conversions: 'Conv.',
  conversion_value: 'Conv. Value',
  video_views: 'Views',
  creative_url: 'URL',
}

export function DataPreview({ data, mappings, maxRows = 5 }: DataPreviewProps) {
  // Get the fields that are mapped
  const mappedFields = CANONICAL_FIELDS.filter(
    (field) => mappings[field] && mappings[field] !== '__none__'
  )

  // Transform the data based on mappings
  const transformedData = data.slice(0, maxRows).map((row) => {
    const transformed: Record<CanonicalField, string> = {} as Record<CanonicalField, string>
    for (const field of mappedFields) {
      const csvColumn = mappings[field]
      transformed[field] = row[csvColumn] || ''
    }
    return transformed
  })

  if (transformedData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No data to preview
      </div>
    )
  }

  const formatValue = (field: CanonicalField, value: string): string => {
    if (!value) return '-'

    switch (field) {
      case 'spend':
      case 'conversion_value':
        const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''))
        return isNaN(numValue) ? value : formatCurrency(numValue)
      case 'impressions':
      case 'clicks':
      case 'conversions':
      case 'video_views':
        const intValue = parseInt(value.replace(/[^0-9]/g, ''), 10)
        return isNaN(intValue) ? value : intValue.toLocaleString()
      default:
        return value
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Data Preview</h3>
        <Badge variant="secondary">
          Showing {transformedData.length} of {data.length} rows
        </Badge>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {mappedFields.map((field) => (
                <TableHead key={field}>{FIELD_LABELS[field]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transformedData.map((row, index) => (
              <TableRow key={index}>
                {mappedFields.map((field) => (
                  <TableCell key={field} className="font-mono text-sm">
                    {formatValue(field, row[field])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
