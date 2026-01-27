'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatCompactNumber } from '@/lib/calculations'

interface TimeSeriesChartProps {
  title: string
  data: Array<{ date: string; value: number; [key: string]: string | number }>
  dataKey?: string
  loading?: boolean
  formatValue?: 'currency' | 'number' | 'percentage'
  color?: string
  height?: number
}

export function TimeSeriesChart({
  title,
  data,
  dataKey = 'value',
  loading,
  formatValue = 'number',
  color = 'var(--chart-1)',
  height = 300,
}: TimeSeriesChartProps) {
  const formatTooltipValue = (value: number): string => {
    switch (formatValue) {
      case 'currency':
        return formatCurrency(value)
      case 'percentage':
        return `${(value * 100).toFixed(2)}%`
      default:
        return formatCompactNumber(value)
    }
  }

  const formatYAxis = (value: number): string => {
    switch (formatValue) {
      case 'currency':
        return `$${formatCompactNumber(value)}`
      case 'percentage':
        return `${(value * 100).toFixed(0)}%`
      default:
        return formatCompactNumber(value)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
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
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
            />
            <Tooltip
              formatter={(value) => [formatTooltipValue(value as number), title]}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
