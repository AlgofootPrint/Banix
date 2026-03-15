-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/eoebmvmzlwrdjdrinuht/sql)

-- 1. Saved images table
create table if not exists saved_images (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  prompt      text,
  mode        text not null,
  preset_id   text,
  storage_path text not null,
  public_url  text not null,
  created_at  timestamptz default now()
);

-- 2. Row Level Security
alter table saved_images enable row level security;

create policy "Users can view their own images"
  on saved_images for select
  using (auth.uid() = user_id);

create policy "Users can insert their own images"
  on saved_images for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own images"
  on saved_images for delete
  using (auth.uid() = user_id);

-- 3. Storage bucket (run after creating the bucket in the dashboard)
-- Go to Storage > New bucket > name: "saved-images" > Public: ON
-- Then run these policies:

insert into storage.buckets (id, name, public) values ('saved-images', 'saved-images', true)
  on conflict do nothing;

create policy "Users can upload their own images"
  on storage.objects for insert
  with check (bucket_id = 'saved-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'saved-images');

create policy "Users can delete their own images"
  on storage.objects for delete
  using (bucket_id = 'saved-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ──────────────────────────────────────────────────────────────────
-- Generation log (tracks daily usage per user or anonymous IP)
-- ──────────────────────────────────────────────────────────────────
create table if not exists generation_log (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade,
  ip         text,
  mode       text not null,
  created_at timestamptz default now()
);

-- Index for fast daily-count queries
create index if not exists generation_log_user_mode_date
  on generation_log (user_id, mode, created_at);

create index if not exists generation_log_ip_mode_date
  on generation_log (ip, mode, created_at);

-- RLS
alter table generation_log enable row level security;

create policy "Users can view their own logs"
  on generation_log for select
  using (auth.uid() = user_id);

create policy "Service can insert logs"
  on generation_log for insert
  with check (true);

-- ──────────────────────────────────────────────────────────────────
-- User plans (tracks subscription tier per user)
-- ──────────────────────────────────────────────────────────────────
create table if not exists user_plans (
  user_id    uuid references auth.users on delete cascade primary key,
  plan       text not null default 'free',
  billing    text,
  expires_at timestamptz,
  updated_at timestamptz default now()
);

-- RLS
alter table user_plans enable row level security;

create policy "Users can view their own plan"
  on user_plans for select
  using (auth.uid() = user_id);

create policy "Service can manage plans"
  on user_plans for all
  using (true);
