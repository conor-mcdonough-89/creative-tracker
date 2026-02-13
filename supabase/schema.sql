-- Ad Creative Tracker Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Platforms enum
create type platform_enum as enum ('meta', 'tiktok', 'google');

-- Sports table
create table if not exists sports (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

-- Seed default sports
insert into sports (name) values
  ('Baseball'), ('Hockey'), ('Football'), ('Basketball'),
  ('Soccer'), ('Golf'), ('Lacrosse'), ('Softball'), ('Tennis'), ('Other')
on conflict (name) do nothing;

-- Payout method enum
create type payout_method_enum as enum ('venmo', 'gusto', 'sidelineswap', 'zelle');

-- Creators table
create table if not exists creators (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  handle text not null,
  social_links jsonb default '{}',
  payout_method payout_method_enum,
  payout_username text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Creator patterns (for ad matching)
create table if not exists creator_patterns (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  pattern text not null,
  created_at timestamp with time zone default now()
);

-- Column mapping presets
create table if not exists column_presets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  platform platform_enum not null,
  mappings jsonb not null, -- { "ad_name": "Campaign Name", "clicks": "Link Clicks", ... }
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Ad performance data (daily granularity)
create table if not exists ad_performance (
  id uuid primary key default uuid_generate_v4(),
  ad_name text not null,
  platform platform_enum not null,
  date date not null,
  impressions integer default 0,
  clicks integer default 0,
  spend numeric(12,2) default 0,
  conversions integer default 0,
  conversion_value numeric(12,2) default 0,
  video_views integer,
  creative_url text,
  sport_id uuid references sports(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Unique constraint for upsert
  unique(ad_name, platform, date)
);

-- Indexes for common queries
create index if not exists idx_ad_performance_date on ad_performance(date);
create index if not exists idx_ad_performance_platform on ad_performance(platform);
create index if not exists idx_ad_performance_ad_name on ad_performance(ad_name);
create index if not exists idx_ad_performance_sport on ad_performance(sport_id);
create index if not exists idx_creator_patterns_pattern on creator_patterns(pattern);
create index if not exists idx_creator_patterns_creator on creator_patterns(creator_id);

-- Users table (managed by Supabase Auth, but add profile info)
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamp with time zone default now()
);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
drop trigger if exists update_creators_updated_at on creators;
create trigger update_creators_updated_at
  before update on creators
  for each row execute function update_updated_at_column();

drop trigger if exists update_column_presets_updated_at on column_presets;
create trigger update_column_presets_updated_at
  before update on column_presets
  for each row execute function update_updated_at_column();

drop trigger if exists update_ad_performance_updated_at on ad_performance;
create trigger update_ad_performance_updated_at
  before update on ad_performance
  for each row execute function update_updated_at_column();

-- Row Level Security
alter table ad_performance enable row level security;
alter table creators enable row level security;
alter table creator_patterns enable row level security;
alter table column_presets enable row level security;
alter table sports enable row level security;
alter table user_profiles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Authenticated users can read all ad_performance" on ad_performance;
drop policy if exists "Authenticated users can insert ad_performance" on ad_performance;
drop policy if exists "Authenticated users can update ad_performance" on ad_performance;
drop policy if exists "Authenticated users can delete ad_performance" on ad_performance;

drop policy if exists "Authenticated users can read all creators" on creators;
drop policy if exists "Authenticated users can insert creators" on creators;
drop policy if exists "Authenticated users can update creators" on creators;
drop policy if exists "Authenticated users can delete creators" on creators;

drop policy if exists "Authenticated users can read all creator_patterns" on creator_patterns;
drop policy if exists "Authenticated users can insert creator_patterns" on creator_patterns;
drop policy if exists "Authenticated users can update creator_patterns" on creator_patterns;
drop policy if exists "Authenticated users can delete creator_patterns" on creator_patterns;

drop policy if exists "Authenticated users can read all column_presets" on column_presets;
drop policy if exists "Authenticated users can insert column_presets" on column_presets;
drop policy if exists "Authenticated users can update column_presets" on column_presets;
drop policy if exists "Authenticated users can delete column_presets" on column_presets;

drop policy if exists "Authenticated users can read all sports" on sports;
drop policy if exists "Authenticated users can insert sports" on sports;
drop policy if exists "Authenticated users can update sports" on sports;
drop policy if exists "Authenticated users can delete sports" on sports;

drop policy if exists "Users can read own profile" on user_profiles;
drop policy if exists "Users can insert own profile" on user_profiles;

-- Policies for ad_performance
create policy "Authenticated users can read all ad_performance" on ad_performance
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert ad_performance" on ad_performance
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update ad_performance" on ad_performance
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete ad_performance" on ad_performance
  for delete using (auth.role() = 'authenticated');

-- Policies for creators
create policy "Authenticated users can read all creators" on creators
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert creators" on creators
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update creators" on creators
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete creators" on creators
  for delete using (auth.role() = 'authenticated');

-- Policies for creator_patterns
create policy "Authenticated users can read all creator_patterns" on creator_patterns
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert creator_patterns" on creator_patterns
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update creator_patterns" on creator_patterns
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete creator_patterns" on creator_patterns
  for delete using (auth.role() = 'authenticated');

-- Policies for column_presets
create policy "Authenticated users can read all column_presets" on column_presets
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert column_presets" on column_presets
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update column_presets" on column_presets
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete column_presets" on column_presets
  for delete using (auth.role() = 'authenticated');

-- Policies for sports
create policy "Authenticated users can read all sports" on sports
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert sports" on sports
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update sports" on sports
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete sports" on sports
  for delete using (auth.role() = 'authenticated');

-- Policies for user_profiles
create policy "Users can read own profile" on user_profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on user_profiles
  for insert with check (auth.uid() = id);

-- Function to automatically create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- View for ads with creator matching (using pattern matching and video captions)
-- Includes platform-adjusted conversion values
-- Matching priority: 1) creator_patterns (substring), 2) creator_videos.caption (exact)
create or replace view ads_with_creators as
select
  ap.*,
  COALESCE(c.creator_id, vc.creator_id) as creator_id,
  COALESCE(c.creator_name, vc.creator_name) as creator_name,
  COALESCE(c.creator_handle, vc.creator_handle) as creator_handle,
  s.name as sport_name,
  COALESCE(pa.conversion_discount, 1.0) as platform_multiplier,
  ap.conversions * COALESCE(pa.conversion_discount, 1.0) as adjusted_conversions,
  ap.conversion_value * COALESCE(pa.conversion_discount, 1.0) as adjusted_conversion_value
from ad_performance ap
-- First priority: pattern matching
left join lateral (
  select cp.creator_id, cr.name as creator_name, cr.handle as creator_handle
  from creator_patterns cp
  join creators cr on cp.creator_id = cr.id
  where ap.ad_name ilike '%' || cp.pattern || '%'
  limit 1
) c on true
-- Second priority: video caption matching (exact match, only if pattern didn't match)
left join lateral (
  select cv.creator_id, cr.name as creator_name, cr.handle as creator_handle
  from creator_videos cv
  join creators cr on cv.creator_id = cr.id
  where c.creator_id is null  -- Only try if pattern match failed
    and cv.caption is not null
    and ap.ad_name = cv.caption
  limit 1
) vc on true
left join sports s on ap.sport_id = s.id
left join platform_adjustments pa on ap.platform = pa.platform;

-- Grant access to the view
grant select on ads_with_creators to authenticated;

-- Video platform enum (social platforms where videos are posted)
create type video_platform_enum as enum ('tiktok', 'instagram', 'youtube', 'other');

-- Ad status enum for creator videos
create type ad_status_enum as enum ('not_running', 'running', 'completed', 'unknown');

-- Creator videos table (for tracking raw videos and their ad status)
create table if not exists creator_videos (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade,
  sport_id uuid references sports(id),
  title text,
  caption text, -- Video caption for matching TikTok ads (exact match on ad_name)
  platform video_platform_enum not null default 'tiktok',
  posted_link text,
  drive_link text,
  platform_code text, -- TikTok code, etc.
  ad_status ad_status_enum not null default 'unknown',
  ad_platforms platform_enum[], -- Which ad platforms it's running on (meta, tiktok, google)
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes for creator_videos
create index if not exists idx_creator_videos_creator on creator_videos(creator_id);
create index if not exists idx_creator_videos_sport on creator_videos(sport_id);
create index if not exists idx_creator_videos_status on creator_videos(ad_status);
create index if not exists idx_creator_videos_platform on creator_videos(platform);
create index if not exists idx_creator_videos_caption on creator_videos(caption);

-- Trigger for updated_at
drop trigger if exists update_creator_videos_updated_at on creator_videos;
create trigger update_creator_videos_updated_at
  before update on creator_videos
  for each row execute function update_updated_at_column();

-- RLS for creator_videos
alter table creator_videos enable row level security;

drop policy if exists "Authenticated users can read all creator_videos" on creator_videos;
drop policy if exists "Authenticated users can insert creator_videos" on creator_videos;
drop policy if exists "Authenticated users can update creator_videos" on creator_videos;
drop policy if exists "Authenticated users can delete creator_videos" on creator_videos;

create policy "Authenticated users can read all creator_videos" on creator_videos
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert creator_videos" on creator_videos
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update creator_videos" on creator_videos
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete creator_videos" on creator_videos
  for delete using (auth.role() = 'authenticated');

-- View for creator videos with relations (caption is part of cv.*)
create or replace view creator_videos_with_relations as
select
  cv.*,
  c.name as creator_name,
  c.handle as creator_handle,
  s.name as sport_name
from creator_videos cv
left join creators c on cv.creator_id = c.id
left join sports s on cv.sport_id = s.id;

-- Platform adjustments table (for conversion discounts, etc.)
create table if not exists platform_adjustments (
  platform platform_enum primary key,
  conversion_discount numeric(4,3) not null default 0, -- 0 to 1, e.g., 0.50 = 50% discount
  updated_at timestamp with time zone default now(),
  updated_by text
);

-- Seed default platform adjustments
-- conversion_discount is a multiplier: 0.50 = 50% of reported, 1.0 = no change
insert into platform_adjustments (platform, conversion_discount) values
  ('meta', 0.50),
  ('tiktok', 1.0),
  ('google', 1.0)
on conflict (platform) do nothing;

-- Trigger for updated_at
drop trigger if exists update_platform_adjustments_updated_at on platform_adjustments;
create trigger update_platform_adjustments_updated_at
  before update on platform_adjustments
  for each row execute function update_updated_at_column();

-- RLS for platform_adjustments
alter table platform_adjustments enable row level security;

-- Everyone can read adjustments (needed for calculations)
drop policy if exists "Authenticated users can read platform_adjustments" on platform_adjustments;
create policy "Authenticated users can read platform_adjustments" on platform_adjustments
  for select using (auth.role() = 'authenticated');

-- Only admin can update (enforced at app level, but RLS allows authenticated users to update)
drop policy if exists "Authenticated users can update platform_adjustments" on platform_adjustments;
create policy "Authenticated users can update platform_adjustments" on platform_adjustments
  for update using (auth.role() = 'authenticated');

-- Partner rate type enum
create type partner_rate_type_enum as enum ('per_video', 'per_month');

-- Partners table (Creators with fixed rate contracts)
create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  handle text not null,
  social_links jsonb default '{}',
  payout_method payout_method_enum,
  payout_username text,
  rate numeric(12,2) not null default 0,
  rate_type partner_rate_type_enum not null default 'per_video',
  contract_start_date date,
  contract_end_date date,
  email text,
  phone_number text,
  notes text,
  converted_from_creator_id uuid references creators(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Partner patterns (for ad matching, same as creators)
create table if not exists partner_patterns (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid references partners(id) on delete cascade,
  pattern text not null,
  created_at timestamp with time zone default now()
);

-- Indexes for partners
create index if not exists idx_partners_contract_dates on partners(contract_start_date, contract_end_date);
create index if not exists idx_partner_patterns_pattern on partner_patterns(pattern);
create index if not exists idx_partner_patterns_partner on partner_patterns(partner_id);

-- Trigger for updated_at on partners
drop trigger if exists update_partners_updated_at on partners;
create trigger update_partners_updated_at
  before update on partners
  for each row execute function update_updated_at_column();

-- RLS for partners
alter table partners enable row level security;
alter table partner_patterns enable row level security;

-- Policies for partners
drop policy if exists "Authenticated users can read all partners" on partners;
drop policy if exists "Authenticated users can insert partners" on partners;
drop policy if exists "Authenticated users can update partners" on partners;
drop policy if exists "Authenticated users can delete partners" on partners;

create policy "Authenticated users can read all partners" on partners
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert partners" on partners
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update partners" on partners
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete partners" on partners
  for delete using (auth.role() = 'authenticated');

-- Policies for partner_patterns
drop policy if exists "Authenticated users can read all partner_patterns" on partner_patterns;
drop policy if exists "Authenticated users can insert partner_patterns" on partner_patterns;
drop policy if exists "Authenticated users can update partner_patterns" on partner_patterns;
drop policy if exists "Authenticated users can delete partner_patterns" on partner_patterns;

create policy "Authenticated users can read all partner_patterns" on partner_patterns
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert partner_patterns" on partner_patterns
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update partner_patterns" on partner_patterns
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete partner_patterns" on partner_patterns
  for delete using (auth.role() = 'authenticated');

-- View for ads with partner matching (similar to ads_with_creators)
create or replace view ads_with_partners as
select
  ap.*,
  p.partner_id,
  p.partner_name,
  p.partner_handle,
  s.name as sport_name,
  COALESCE(pa.conversion_discount, 1.0) as platform_multiplier,
  ap.conversions * COALESCE(pa.conversion_discount, 1.0) as adjusted_conversions,
  ap.conversion_value * COALESCE(pa.conversion_discount, 1.0) as adjusted_conversion_value
from ad_performance ap
left join lateral (
  select pp.partner_id, pr.name as partner_name, pr.handle as partner_handle
  from partner_patterns pp
  join partners pr on pp.partner_id = pr.id
  where ap.ad_name ilike '%' || pp.pattern || '%'
  limit 1
) p on true
left join sports s on ap.sport_id = s.id
left join platform_adjustments pa on ap.platform = pa.platform;

-- Grant access to the partners view
grant select on ads_with_partners to authenticated;

-- Payout status enum
create type payout_status_enum as enum ('paid', 'unpaid');

-- Payouts table (invoice-like records for creator payouts)
create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references creators(id) on delete cascade not null,
  payout_method payout_method_enum,
  payout_username text,
  date_start date not null,
  date_end date not null,
  amount numeric(12,2) not null,
  status payout_status_enum not null default 'unpaid',
  paid_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for payouts
create index if not exists idx_payouts_creator on payouts(creator_id);
create index if not exists idx_payouts_status on payouts(status);
create index if not exists idx_payouts_dates on payouts(date_start, date_end);
create index if not exists idx_payouts_paid_at on payouts(paid_at);

-- Trigger for updated_at on payouts
drop trigger if exists update_payouts_updated_at on payouts;
create trigger update_payouts_updated_at
  before update on payouts
  for each row execute function update_updated_at_column();

-- RLS for payouts
alter table payouts enable row level security;

-- Policies for payouts
drop policy if exists "Authenticated users can read all payouts" on payouts;
drop policy if exists "Authenticated users can insert payouts" on payouts;
drop policy if exists "Authenticated users can update payouts" on payouts;
drop policy if exists "Authenticated users can delete payouts" on payouts;

create policy "Authenticated users can read all payouts" on payouts
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert payouts" on payouts
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update payouts" on payouts
  for update using (auth.role() = 'authenticated');

-- Only admin can delete payouts (enforced at app level)
create policy "Authenticated users can delete payouts" on payouts
  for delete using (auth.role() = 'authenticated');

-- Function to check for overlapping payout date ranges
create or replace function check_payout_overlap(
  p_creator_id uuid,
  p_date_start date,
  p_date_end date,
  p_exclude_id uuid default null
) returns boolean as $$
begin
  return exists (
    select 1 from payouts
    where creator_id = p_creator_id
      and (p_exclude_id is null or id != p_exclude_id)
      and date_start <= p_date_end
      and date_end >= p_date_start
  );
end;
$$ language plpgsql;

-- Import logs table (for tracking and rolling back data imports)
create table if not exists import_logs (
  id uuid primary key default uuid_generate_v4(),
  file_name text not null,
  platform platform_enum not null,
  record_count integer not null default 0,
  date_range_start date,
  date_range_end date,
  imported_by text,
  status text not null default 'completed', -- 'completed', 'rolled_back'
  rolled_back_at timestamp with time zone,
  rolled_back_by text,
  created_at timestamp with time zone default now()
);

-- Add import_id to ad_performance to track which import created each record
alter table ad_performance add column if not exists import_id uuid references import_logs(id) on delete set null;

-- Index for import lookups
create index if not exists idx_ad_performance_import on ad_performance(import_id);
create index if not exists idx_import_logs_created on import_logs(created_at desc);
create index if not exists idx_import_logs_status on import_logs(status);

-- RLS for import_logs
alter table import_logs enable row level security;

drop policy if exists "Authenticated users can read all import_logs" on import_logs;
drop policy if exists "Authenticated users can insert import_logs" on import_logs;
drop policy if exists "Authenticated users can update import_logs" on import_logs;
drop policy if exists "Authenticated users can delete import_logs" on import_logs;

create policy "Authenticated users can read all import_logs" on import_logs
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert import_logs" on import_logs
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update import_logs" on import_logs
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete import_logs" on import_logs
  for delete using (auth.role() = 'authenticated');
