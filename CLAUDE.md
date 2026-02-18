# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build (also type-checks)
npm run lint     # Run ESLint
npm run start    # Start production server
```

## Tech Stack

- **Next.js 16** with App Router, React 19, TypeScript (strict mode)
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **Supabase** for authentication and PostgreSQL database
- **shadcn/ui** components built on Radix UI primitives
- **Recharts** for data visualization
- **PapaParse** for CSV parsing

## Architecture

### App Structure

- `app/(dashboard)/` - Route group for authenticated pages (uses `force-dynamic` to disable prerendering)
- `app/login/` and `app/auth/` - Authentication flow
- `components/ui/` - shadcn/ui base components
- `components/layout/` - Sidebar and Header shared layout components
- `components/dashboard/`, `creators/`, `videos/`, `upload/` - Feature-specific components
- `lib/supabase/server.ts` - Server-side Supabase client (uses cookies)
- `lib/supabase/client.ts` - Browser-side Supabase client
- `hooks/usePlatformAdjustments.ts` - Loads per-platform multipliers from DB and syncs to `lib/calculations.ts`

### Data Model

The app tracks ad performance across Meta, TikTok, and Google platforms:

- **creators** - Content creators with social links and payout info
- **creator_patterns** - Substring patterns to match ad names to creators
- **ad_performance** - Daily ad metrics (unique on ad_name + platform + date)
- **ads_with_creators** - Postgres view that joins ads with matched creators
- **creator_videos** - Raw video tracking with ad status
- **platform_adjustments** - Per-platform conversion multipliers
- **column_presets** - Saved CSV column mappings for uploads
- **sports** - Categories for ads/videos

### Key Business Logic

**Creator-Ad Matching**: Ads are linked to creators via pattern matching. The `creator_patterns` table stores substring patterns; when an ad name contains a pattern (case-insensitive), it's attributed to that creator.

**Platform Adjustments** (`lib/calculations.ts`): Conversion values are scaled per platform using a multiplier stored in `platform_adjustments` (e.g., Meta defaults to `0.5`, meaning 50% of the reported value is used). Multipliers are loaded from DB via `usePlatformAdjustments` and stored in a module-level variable in `lib/calculations.ts`. The `settings/adjustments` page is restricted to `ADMIN_EMAIL` (`conor@sidelineswap.com`). `lib/calculations.ts` also exports metric helpers: `calculateCTR`, `calculateCPM`, `calculateCPC`, `calculateROAS`, `aggregatePerformance`, and formatting utilities (`formatCurrency`, `formatCompactNumber`, etc.).

**Revenue Calculations**:
- GMV = conversion_value (after platform adjustment)
- Revenue = GMV × 11.5% (REVENUE_RATE)
- Creator Payout = Revenue × 10% (PAYOUT_RATE)

### Supabase Integration

- Row Level Security enabled on all tables
- Auth uses Supabase SSR package with middleware for session refresh
- Views and RLS policies are defined in `supabase/schema.sql`

## Path Aliases

Use `@/*` to import from project root (e.g., `@/lib/types`, `@/components/ui/button`).

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
