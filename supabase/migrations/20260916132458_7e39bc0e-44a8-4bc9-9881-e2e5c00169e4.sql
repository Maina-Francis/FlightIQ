create table public.flight_price_cache (
  route_key text primary key,
  cheapest_price numeric not null,
  currency text not null default 'USD',
  skyscanner_link text not null default '',
  updated_at timestamptz not null default now()
);

grant all on public.flight_price_cache to service_role;

alter table public.flight_price_cache enable row level security;

revoke execute on function public.handle_new_user() from public, anon, authenticated;