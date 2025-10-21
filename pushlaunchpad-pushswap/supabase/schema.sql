-- Public table for durable launch listings
create table if not exists public.launches (
  token text primary key,
  name text not null,
  symbol text not null,
  mediaURI text,
  dev text not null,
  quoteAsset text not null,
  timestamp bigint not null,
  blockNumber bigint not null,
  raised numeric default 0,
  baseSold numeric default 0,
  progress real default 0,
  status text not null check (status in ('active','completed')),
  latestBlock bigint default 0
);

-- Helpful indexes
create index if not exists launches_timestamp_idx on public.launches (timestamp desc);
create index if not exists launches_block_idx on public.launches (blockNumber desc);

-- Enable RLS (Row Level Security) with permissive anon access for read
alter table public.launches enable row level security;

-- Policies (dev-friendly: anon can read and upsert by token)
drop policy if exists "anon_can_select_launches" on public.launches;
create policy "anon_can_select_launches"
  on public.launches for select
  to anon
  using (true);

drop policy if exists "anon_can_upsert_launches" on public.launches;
create policy "anon_can_upsert_launches"
  on public.launches for insert
  to anon
  with check (true);

drop policy if exists "anon_can_update_launches" on public.launches;
create policy "anon_can_update_launches"
  on public.launches for update
  to anon
  using (true)
  with check (true);

-- Positions table for Uniswap V3 position NFTs per owner
create table if not exists public.positions (
  owner text not null,
  chainId integer not null default 42101,
  tokenId bigint not null,
  token0 text,
  token1 text,
  fee integer,
  tickLower integer,
  tickUpper integer,
  liquidity numeric,
  tokensOwed0 numeric,
  tokensOwed1 numeric,
  pool text,
  status text default 'active' check (status in ('active','closed')),
  lastSeenBlock bigint default 0,
  updatedAt timestamptz default now(),
  primary key (owner, tokenId)
);

create index if not exists positions_owner_idx on public.positions (owner);
create index if not exists positions_status_idx on public.positions (status);
create index if not exists positions_chain_idx on public.positions (chainId);

alter table public.positions enable row level security;

drop policy if exists "anon_can_select_positions" on public.positions;
create policy "anon_can_select_positions"
  on public.positions for select
  to anon
  using (true);

drop policy if exists "anon_can_upsert_positions" on public.positions;
create policy "anon_can_upsert_positions"
  on public.positions for insert
  to anon
  with check (true);

drop policy if exists "anon_can_update_positions" on public.positions;
create policy "anon_can_update_positions"
  on public.positions for update
  to anon
  using (true)
  with check (true);
