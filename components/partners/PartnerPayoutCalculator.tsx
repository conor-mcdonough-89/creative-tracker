import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/calculations'
import type { PartnerRateType } from '@/lib/types'

interface PartnerPayoutCalculatorProps {
  rate: number
  rateType: PartnerRateType
  videoCount: number
  monthsInRange: number
  dateRangeLabel: string
}

export function PartnerPayoutCalculator({
  rate,
  rateType,
  videoCount,
  monthsInRange,
  dateRangeLabel,
}: PartnerPayoutCalculatorProps) {
  const payout = rateType === 'per_video'
    ? rate * videoCount
    : rate * monthsInRange

  return (
    <Card className="bg-green-50 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="text-lg">Payout for {dateRangeLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-4xl font-bold text-green-600">
          {formatCurrency(payout)}
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-medium">
              {formatCurrency(rate)} / {rateType === 'per_video' ? 'video' : 'month'}
            </span>
          </div>
          {rateType === 'per_video' ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Videos in Period</span>
              <span className="font-medium">{videoCount}</span>
            </div>
          ) : (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Months in Period</span>
              <span className="font-medium">{monthsInRange}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Total Payout</span>
            <span className="font-bold text-green-600">{formatCurrency(payout)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Formula: {formatCurrency(rate)} x {rateType === 'per_video' ? `${videoCount} videos` : `${monthsInRange} month(s)`}
        </p>
      </CardContent>
    </Card>
  )
}
