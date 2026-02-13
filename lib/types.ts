// Platform enum (for ads)
export type Platform = 'meta' | 'tiktok' | 'google'

// Video platform enum (where videos are posted)
export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'other'

// Ad status for creator videos
export type AdStatus = 'not_running' | 'running' | 'completed' | 'unknown'

// Payout method for creators
export type PayoutMethod = 'venmo' | 'gusto' | 'sidelineswap' | 'zelle'

// Sports
export interface Sport {
  id: string
  name: string
  created_at: string
}

// Platform adjustments (for conversion discounts)
export interface PlatformAdjustment {
  platform: Platform
  conversion_discount: number // 0 to 1, e.g., 0.50 = 50% discount
  updated_at: string
  updated_by: string | null
}

// Creator
export interface Creator {
  id: string
  name: string
  handle: string
  social_links: {
    tiktok?: string
    instagram?: string
    youtube?: string
    twitter?: string
    [key: string]: string | undefined
  }
  payout_method: PayoutMethod | null
  payout_username: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Creator pattern for ad matching
export interface CreatorPattern {
  id: string
  creator_id: string
  pattern: string
  created_at: string
}

// Creator video (raw video tracking)
export interface CreatorVideo {
  id: string
  creator_id: string | null
  sport_id: string | null
  title: string | null
  caption: string | null  // Video caption for matching TikTok ads (exact match on ad_name)
  platform: VideoPlatform
  posted_link: string | null
  drive_link: string | null
  platform_code: string | null
  ad_status: AdStatus
  ad_platforms: Platform[] | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Creator video with related data
export interface CreatorVideoWithRelations extends CreatorVideo {
  creator_name: string | null
  creator_handle: string | null
  sport_name: string | null
}

// Column mapping preset
export interface ColumnPreset {
  id: string
  name: string
  platform: Platform
  mappings: {
    ad_name?: string
    date?: string
    impressions?: string
    clicks?: string
    spend?: string
    conversions?: string
    conversion_value?: string
    video_views?: string
    creative_url?: string
    [key: string]: string | undefined
  }
  created_at: string
  updated_at: string
}

// Ad performance data (daily granularity)
export interface AdPerformance {
  id: string
  ad_name: string
  platform: Platform
  date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  video_views: number | null
  creative_url: string | null
  sport_id: string | null
  created_at: string
  updated_at: string
}

// User profile
export interface UserProfile {
  id: string
  email: string
  created_at: string
}

// Calculated metrics for an ad or aggregated data
export interface CalculatedMetrics {
  ctr: number  // clicks / impressions
  cpm: number  // (spend / impressions) * 1000
  cpc: number  // spend / clicks
  roas: number // conversion_value / spend
}

// Aggregated performance data
export interface AggregatedPerformance {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  video_views: number
  // Calculated
  ctr: number
  cpm: number
  cpc: number
  roas: number
  // Revenue and payout
  gmv: number
  revenue: number
  payout: number
}

// Creator with aggregated performance
export interface CreatorWithPerformance extends Creator {
  performance: AggregatedPerformance
  sports: Sport[]
  matched_ads_count: number
}

// Ad with creator and sport info (from ads_with_creators view)
export interface AdWithRelations extends AdPerformance {
  creator_id?: string | null
  creator_name?: string | null
  creator_handle?: string | null
  sport_name?: string | null
  // Platform-adjusted values (from view)
  platform_multiplier?: number
  adjusted_conversions?: number
  adjusted_conversion_value?: number
}

// Filter types
export interface DateRange {
  from: Date
  to: Date
}

export interface Filters {
  platforms: Platform[]
  sports: string[]  // sport IDs
  creators: string[] // creator IDs
  dateRange: DateRange
  search?: string
}

// Time series data point
export interface TimeSeriesDataPoint {
  date: string
  value: number
  [key: string]: string | number
}

// Platform breakdown
export interface PlatformBreakdown {
  platform: Platform
  spend: number
  conversions: number
  conversion_value: number
}

// Sport breakdown
export interface SportBreakdown {
  sport_id: string | null
  sport_name: string
  conversion_value: number
}

// Granularity for charts
export type Granularity = 'daily' | 'weekly' | 'monthly'

// CSV row type (before mapping)
export interface CSVRow {
  [key: string]: string
}

// Canonical fields for mapping
export const CANONICAL_FIELDS = [
  'ad_name',
  'campaign_name',
  'date',
  'impressions',
  'clicks',
  'spend',
  'conversions',
  'conversion_value',
  'video_views',
  'creative_url',
] as const

export type CanonicalField = typeof CANONICAL_FIELDS[number]

// Date range presets
export type DateRangePreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'custom'

// Default sports list
export const DEFAULT_SPORTS = [
  'Baseball',
  'Hockey',
  'Football',
  'Basketball',
  'Soccer',
  'Golf',
  'Lacrosse',
  'Softball',
  'Tennis',
  'Other',
] as const
