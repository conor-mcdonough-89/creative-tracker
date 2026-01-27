import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/calculations'
import { REVENUE_RATE, PAYOUT_RATE } from '@/lib/calculations'

interface PayoutCalculatorProps {
  gmv: number
  dateRangeLabel: string
}

export function PayoutCalculator({ gmv, dateRangeLabel }: PayoutCalculatorProps) {
  const revenue = gmv * REVENUE_RATE
  const payout = revenue * PAYOUT_RATE

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
            <span className="text-muted-foreground">GMV (Conversion Value)</span>
            <span className="font-medium">{formatCurrency(gmv)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Revenue ({(REVENUE_RATE * 100).toFixed(1)}% of GMV)
            </span>
            <span className="font-medium">{formatCurrency(revenue)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">
              Payout ({(PAYOUT_RATE * 100).toFixed(0)}% of Revenue)
            </span>
            <span className="font-bold text-green-600">{formatCurrency(payout)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Formula: {(PAYOUT_RATE * 100).toFixed(0)}% × ({(REVENUE_RATE * 100).toFixed(1)}% × GMV)
        </p>
      </CardContent>
    </Card>
  )
}
