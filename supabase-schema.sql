-- 자리있나요 Supabase 초기 스키마
-- Supabase SQL Editor에서 실행할 수 있는 초안입니다.

create extension if not exists "pgcrypto";

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  external_source text not null default 'manual',
  external_place_id text,
  external_link text,
  name text not null,
  category text not null check (category in ('cafe', 'study', 'food', 'other')),
  address text not null,
  road_address text,
  latitude double precision,
  longitude double precision,
  floor_plan_image_url text,
  total_seats integer not null check (total_seats > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (external_source, external_place_id)
);

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  label text not null,
  x numeric(5,2) not null default 50 check (x >= 0 and x <= 100),
  y numeric(5,2) not null default 50 check (y >= 0 and y <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, label)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  auth_method text not null default 'email',
  phone text,
  point_balance integer not null default 0 check (point_balance >= 0),
  trust_score integer not null default 70 check (trust_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.merchant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table public.store_claims (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  merchant_id uuid not null references public.merchant_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (store_id, merchant_id)
);

create table public.seat_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  seat_id uuid not null references public.seats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'ended', 'expired', 'reported')),
  expected_end_at timestamptz not null,
  ended_at timestamptz,
  memo text,
  created_at timestamptz not null default now()
);

create index seat_sessions_active_idx
  on public.seat_sessions (store_id, seat_id, expected_end_at)
  where status = 'active';

create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.seat_sessions(id) on delete set null,
  amount integer not null,
  reason text not null,
  verification_method text not null default 'unverified',
  is_withheld boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_point_cooldowns (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_earned_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.verified_visits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.seat_sessions(id) on delete set null,
  verification_method text not null check (verification_method in ('qr', 'nfc', 'receipt_code', 'location_demo')),
  verified_at timestamptz not null default now()
);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  merchant_id uuid references public.merchant_profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  fee_per_verified_visit integer not null default 300 check (fee_per_verified_visit >= 0),
  daily_budget integer not null default 50000 check (daily_budget >= 0),
  created_at timestamptz not null default now()
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.ad_campaigns(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  verified_visit_id uuid references public.verified_visits(id) on delete set null,
  amount integer not null check (amount >= 0),
  reason text not null check (reason in ('verified_visit', 'ad_click', 'manual_adjustment')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'void')),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.seat_sessions(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (reporter_id, session_id)
);

alter table public.stores enable row level security;
alter table public.seats enable row level security;
alter table public.profiles enable row level security;
alter table public.merchant_profiles enable row level security;
alter table public.store_claims enable row level security;
alter table public.seat_sessions enable row level security;
alter table public.point_events enable row level security;
alter table public.verified_visits enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.billing_events enable row level security;
alter table public.reports enable row level security;

create policy "Anyone can read active stores"
  on public.stores for select
  using (is_active = true);

create policy "Anyone can read active seats"
  on public.seats for select
  using (is_active = true);

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Anyone can read active seat sessions"
  on public.seat_sessions for select
  using (status = 'active');

create policy "Users can create their own sessions"
  on public.seat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can end their own sessions"
  on public.seat_sessions for update
  using (auth.uid() = user_id);

create policy "Users can read their own point events"
  on public.point_events for select
  using (auth.uid() = user_id);

create policy "Users can create their own point events"
  on public.point_events for insert
  with check (auth.uid() = user_id and amount between 0 and 50);

create policy "Users can read their own cooldown"
  on public.user_point_cooldowns for select
  using (auth.uid() = user_id);

create policy "Users can read their own verified visits"
  on public.verified_visits for select
  using (auth.uid() = user_id);

create policy "Users can create their own verified visits"
  on public.verified_visits for insert
  with check (auth.uid() = user_id);

create policy "Anyone can read active ad campaigns"
  on public.ad_campaigns for select
  using (status = 'active');

create policy "Users can create own pending billing events"
  on public.billing_events for insert
  with check (auth.uid() = user_id and status = 'pending');

create policy "Users can read their own billing events"
  on public.billing_events for select
  using (auth.uid() = user_id);

create policy "Users can create reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can read their own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

create or replace function public.end_seat_session_with_points(session_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.seat_sessions%rowtype;
  now_at timestamptz := now();
  verified boolean := false;
  last_earned timestamptz;
  minutes_early integer := 0;
  earned_points integer := 0;
begin
  select *
    into target_session
    from public.seat_sessions
   where id = session_uuid
     and user_id = auth.uid()
     and status = 'active'
   for update;

  if not found then
    return 0;
  end if;

  update public.seat_sessions
     set status = 'ended',
         ended_at = now_at
   where id = target_session.id;

  select exists (
    select 1
      from public.verified_visits
     where session_id = target_session.id
       and user_id = auth.uid()
  )
  into verified;

  select last_earned_at
    into last_earned
    from public.user_point_cooldowns
   where user_id = auth.uid();

  if now_at < target_session.expected_end_at
     and verified
     and (last_earned is null or now_at - last_earned >= interval '1 hour') then
    minutes_early := greatest(
      0,
      ceil(extract(epoch from (target_session.expected_end_at - now_at)) / 60)::integer
    );
    earned_points := least(50, greatest(5, minutes_early));

    insert into public.point_events (
      user_id,
      session_id,
      amount,
      reason,
      verification_method,
      is_withheld
    )
    values (
      auth.uid(),
      target_session.id,
      earned_points,
      'early_release',
      'receipt_code',
      false
    );

    insert into public.user_point_cooldowns (user_id, last_earned_at, updated_at)
    values (auth.uid(), now_at, now_at)
    on conflict (user_id)
    do update set
      last_earned_at = excluded.last_earned_at,
      updated_at = excluded.updated_at;

    update public.profiles
       set point_balance = point_balance + earned_points
     where id = auth.uid();
  end if;

  return earned_points;
end;
$$;

grant execute on function public.end_seat_session_with_points(uuid) to authenticated;

alter publication supabase_realtime add table public.seat_sessions;
alter publication supabase_realtime add table public.verified_visits;
