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

-- View for ads with creator matching (using pattern matching)
create or replace view ads_with_creators as
select
  ap.*,
  c.creator_id,
  c.creator_name,
  c.creator_handle,
  s.name as sport_name
from ad_performance ap
left join lateral (
  select cp.creator_id, cr.name as creator_name, cr.handle as creator_handle
  from creator_patterns cp
  join creators cr on cp.creator_id = cr.id
  where ap.ad_name ilike '%' || cp.pattern || '%'
  limit 1
) c on true
left join sports s on ap.sport_id = s.id;

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

-- View for creator videos with relations
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
insert into platform_adjustments (platform, conversion_discount) values
  ('meta', 0.50),
  ('tiktok', 0),
  ('google', 0)
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
