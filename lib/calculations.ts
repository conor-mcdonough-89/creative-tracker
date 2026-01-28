// Revenue and payout calculation constants
export const REVENUE_RATE = 0.115 // 11.5% of GMV (conversion_value) is revenue
export const PAYOUT_RATE = 0.10  // 10% of revenue goes to creator

// Admin email for restricted settings
export const ADMIN_EMAIL = 'conor@sidelineswap.com'

// Default platform-specific conversion discounts (fallback if DB not loaded)
export const DEFAULT_PLATFORM_DISCOUNTS: Record<string, number> = {
  meta: 0.50, // Discount Meta conversions by 50%
  tiktok: 0,
  google: 0,
}

// Mutable store for platform discounts (loaded from DB)
let platformDiscounts: Record<string, number> = { ...DEFAULT_PLATFORM_DISCOUNTS }

/**
 * Set platform discounts (called when loaded from database)
 */
export function setPlatformDiscounts(discounts: Record<string, number>) {
  platformDiscounts = { ...DEFAULT_PLATFORM_DISCOUNTS, ...discounts }
}

/**
 * Get current platform discounts
 */
export function getPlatformDiscounts(): Record<string, number> {
  return { ...platformDiscounts }
}

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
 * Apply platform-specific discount to conversions
 */
export function applyConversionDiscount(
  conversions: number,
  conversionValue: number,
  platform?: string
): { conversions: number; conversion_value: number } {
  const discount = platform ? (platformDiscounts[platform] ?? 0) : 0
  const multiplier = 1 - discount
  return {
    conversions: conversions * multiplier,
    conversion_value: conversionValue * multiplier,
  }
}

/**
 * Aggregate multiple performance records
 * Applies platform-specific discounts to conversions (e.g., 50% discount for Meta)
 */
export function aggregatePerformance(records: Array<{
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  video_views?: number | null
  platform?: string
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
    (acc, record) => {
      // Apply platform-specific discount to conversions
      const { conversions, conversion_value } = applyConversionDiscount(
        record.conversions,
        record.conversion_value,
        record.platform
      )

      return {
        impressions: acc.impressions + record.impressions,
        clicks: acc.clicks + record.clicks,
        spend: acc.spend + record.spend,
        conversions: acc.conversions + conversions,
        conversion_value: acc.conversion_value + conversion_value,
        video_views: acc.video_views + (record.video_views ?? 0),
      }
    },
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
