-- Jaritnyang demo data for the first real Supabase DB.
-- Run this after supabase-schema.sql.

insert into public.stores (
  external_source,
  external_place_id,
  name,
  category,
  address,
  road_address,
  latitude,
  longitude,
  total_seats
)
values
  (
    'jaritnyang-seed',
    'gangnam-cafe-luna',
    '카페 루나 강남',
    'cafe',
    '서울 강남구 테헤란로 22길',
    '서울 강남구 테헤란로 22길',
    37.501,
    127.039,
    12
  ),
  (
    'jaritnyang-seed',
    'gangnam-bistro-neul',
    '비스트로 늘 강남',
    'food',
    '서울 강남구 강남대로 96길',
    '서울 강남구 강남대로 96길',
    37.499,
    127.028,
    14
  ),
  (
    'jaritnyang-seed',
    'yeoksam-focus-den',
    '포커스덴 역삼',
    'study',
    '서울 강남구 역삼로 85길',
    '서울 강남구 역삼로 85길',
    37.502,
    127.036,
    20
  )
on conflict (external_source, external_place_id)
do update set
  name = excluded.name,
  category = excluded.category,
  address = excluded.address,
  road_address = excluded.road_address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  total_seats = excluded.total_seats,
  is_active = true;

insert into public.seats (store_id, label, x, y)
select
  stores.id,
  seat_number || '번 좌석',
  12 + ((seat_number - 1) % ceil(sqrt(stores.total_seats))::integer) * 76 / greatest(1, ceil(sqrt(stores.total_seats))::integer - 1),
  17 + floor((seat_number - 1) / ceil(sqrt(stores.total_seats))::integer) * 66 / greatest(1, ceil(stores.total_seats / ceil(sqrt(stores.total_seats)))::integer - 1)
from public.stores
cross join lateral generate_series(1, stores.total_seats) as seat_number
where stores.external_source = 'jaritnyang-seed'
on conflict (store_id, label)
do update set
  x = excluded.x,
  y = excluded.y,
  is_active = true;

insert into public.ad_campaigns (store_id, status, fee_per_verified_visit, daily_budget)
select stores.id, 'active', 300, 50000
from public.stores
where stores.external_source = 'jaritnyang-seed'
  and stores.category in ('cafe', 'food')
  and not exists (
    select 1
    from public.ad_campaigns
    where ad_campaigns.store_id = stores.id
  );
