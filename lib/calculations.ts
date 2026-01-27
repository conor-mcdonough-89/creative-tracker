// Revenue and payout calculation constants
export const REVENUE_RATE = 0.115 // 11.5% of GMV (conversion_value) is revenue
export const PAYOUT_RATE = 0.10  // 10% of revenue goes to creator

/**
 * Calculate payout for a given conversion value (GMV)
 */
export function calculateCreatorPayout(conversionValue: number): {
  gmv: number
  revenue: number
  payout: number
} {
  const gmv = conversionValue
  const revenue = gmv * REVENUE_RATE
  const payout = revenue * PAYOUT_RATE
  // Equivalent: payout = gmv * 0.0115
  return { gmv, revenue, payout }
}

/**
 * Calculate CTR (Click-Through Rate)
 * @returns CTR as a decimal (e.g., 0.05 for 5%)
 */
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0
  return clicks / impressions
}

/**
 * Calculate CPM (Cost Per Mille / 1000 impressions)
 */
export function calculateCPM(spend: number, impressions: number): number {
  if (impressions === 0) return 0
  return (spend / impressions) * 1000
}

/**
 * Calculate CPC (Cost Per Click)
 */
export function calculateCPC(spend: number, clicks: number): number {
  if (clicks === 0) return 0
  return spend / clicks
}

/**
 * Calculate ROAS (Return On Ad Spend)
 */
export function calculateROAS(conversionValue: number, spend: number): number {
  if (spend === 0) return 0
  return conversionValue / spend
}

/**
 * Calculate all metrics from raw performance data
 */
export function calculateMetrics(data: {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  video_views?: number
}) {
  const { impressions, clicks, spend, conversions, conversion_value, video_views = 0 } = data

  return {
    impressions,
    clicks,
    spend,
    conversions,
    conversion_value,
    video_views,
    ctr: calculateCTR(clicks, impressions),
    cpm: calculateCPM(spend, impressions),
    cpc: calculateCPC(spend, clicks),
    roas: calculateROAS(conversion_value, spend),
    ...calculateCreatorPayout(conversion_value),
  }
}

/**
 * Aggregate multiple performance records
 */
export function aggregatePerformance(records: Array<{
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  video_views?: number | null
}>) {
  type Totals = {
    impressions: number
    clicks: number
    spend: number
    conversions: number
    conversion_value: number
    video_views: number
  }

  const initialValue: Totals = {
    impressions: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    conversion_value: 0,
    video_views: 0,
  }

  const totals = records.reduce<Totals>(
    (acc, record) => ({
      impressions: acc.impressions + record.impressions,
      clicks: acc.clicks + record.clicks,
      spend: acc.spend + record.spend,
      conversions: acc.conversions + record.conversions,
      conversion_value: acc.conversion_value + record.conversion_value,
      video_views: acc.video_views + (record.video_views ?? 0),
    }),
    initialValue
  )

  return calculateMetrics(totals)
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format large numbers with K, M suffixes
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
