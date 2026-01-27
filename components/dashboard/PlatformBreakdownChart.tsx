'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatCompactNumber } from '@/lib/calculations'
import type { Platform } from '@/lib/types'

interface PlatformBreakdownChartProps {
  data: Array<{ platform: Platform; value: number }>
  title: string
  loading?: boolean
  formatValue?: 'currency' | 'number'
}

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: '#1877F2',
  tiktok: '#010101',
  google: '#4285F4',
}

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
}

export function PlatformBreakdownChart({
  data,
  title,
  loading,
  formatValue = 'currency',
}: PlatformBreakdownChartProps) {
  const chartData = data.map((d) => ({
    name: PLATFORM_LABELS[d.platform],
    value: d.value,
    color: PLATFORM_COLORS[d.platform],
  }))

  const formatTooltipValue = (value: number): string => {
    return formatValue === 'currency' ? formatCurrency(value) : formatCompactNumber(value)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 50, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) =>
                formatValue === 'currency' ? `$${formatCompactNumber(value)}` : formatCompactNumber(value)
              }
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => [formatTooltipValue(value as number)]}
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
