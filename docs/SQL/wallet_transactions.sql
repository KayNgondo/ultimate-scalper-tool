-- Run this in Supabase SQL editor first

create type if not exists cash_tx_type as enum ('deposit','withdrawal','fee','correction');

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  type cash_tx_type not null,
  currency text default 'USD' not null,
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

alter table wallet_transactions enable row level security;

do $$ begin
  create policy "wallet_tx: owner can read"
    on wallet_transactions for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wallet_tx: owner can insert"
    on wallet_transactions for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wallet_tx: owner can update"
    on wallet_transactions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "wallet_tx: owner can delete"
    on wallet_transactions for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace view v_user_net_cashflow as
select
  user_id,
  sum(
    case
      when type = 'deposit' then amount
      when type in ('withdrawal','fee') then -amount
      when type = 'correction' then amount
    end
  ) as net_cashflow
from wallet_transactions
group by user_id;
