-- ============================================================================
--  Minhas Financas — esquema do banco (Supabase / PostgreSQL)
--
--  Como usar:
--    1. abra seu projeto em https://supabase.com
--    2. va em "SQL Editor" -> "New query"
--    3. cole TODO este arquivo e clique em "Run"
--
--  Pode rodar mais de uma vez: tudo aqui e idempotente.
--
--  Seguranca: todas as tabelas ficam com Row Level Security ligada e cada
--  politica compara `auth.uid()` com `user_id`. Ou seja, mesmo usando a chave
--  publica (anon) no navegador, um usuario so enxerga e altera as proprias
--  linhas.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ categorias
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  -- slot da paleta categorica do app (8 cores, ordem fixa)
  color_index smallint not null default 0 check (color_index between 0 and 7),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- --------------------------------------------------------------------- gastos
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- "restrict": apagar uma categoria com gastos exige mover os gastos antes,
  -- o que e exatamente o que a tela de categorias faz.
  category_id uuid not null references public.categories (id) on delete restrict,
  amount      numeric(12, 2) not null check (amount > 0),
  date        date not null,
  description text not null default '' check (char_length(description) <= 120),
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_date_idx
  on public.expenses (user_id, date desc, created_at desc);

create index if not exists expenses_category_idx
  on public.expenses (category_id);

-- ----------------------------------------------------------------- orcamentos
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  -- sempre o primeiro dia do mes de referencia (ex.: 2026-09-01)
  month        date not null check (extract(day from month) = 1),
  limit_amount numeric(12, 2) not null check (limit_amount > 0),
  created_at   timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index if not exists budgets_user_month_idx
  on public.budgets (user_id, month);

-- ----------------------------------------------------------------- rendas
-- Uma linha por ganho, no dia em que entrou — mesma forma de um gasto. Quem
-- recebe todo dia lanca varios por mes; quem tem renda fixa lanca um so. O
-- total do mes e sempre a soma das linhas do periodo.
create table if not exists public.incomes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  source     text not null check (char_length(btrim(source)) between 1 and 40),
  amount     numeric(12, 2) not null check (amount > 0),
  date       date not null,
  created_at timestamptz not null default now()
);

-- Migracao: a primeira versao desta tabela guardava so o mes (dia 1) na coluna
-- `month`. Renomeia para `date` preservando os valores — cada renda fixa vira
-- um lancamento no dia 1 daquele mes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'incomes' and column_name = 'month'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'incomes' and column_name = 'date'
  ) then
    alter table public.incomes drop constraint if exists incomes_month_check;
    alter table public.incomes rename column month to date;
  end if;
end $$;

drop index if exists public.incomes_user_month_idx;

create index if not exists incomes_user_date_idx
  on public.incomes (user_id, date desc, created_at desc);

-- ------------------------------------------------------------- a receber
-- Valores que outras pessoas devem ao usuario. Nao entram no total gasto
-- nem na sobra do mes: sao so um lembrete de cobranca.
create table if not exists public.receivables (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  person      text not null check (char_length(btrim(person)) between 1 and 60),
  amount      numeric(12, 2) not null check (amount > 0),
  date        date not null,
  description text not null default '' check (char_length(description) <= 120),
  -- null enquanto estiver pendente; data do pagamento quando recebido
  received_at date,
  created_at  timestamptz not null default now()
);

create index if not exists receivables_user_idx
  on public.receivables (user_id, received_at, date desc, created_at desc);

-- --------------------------------------------------------------- a pagar
-- Espelho de `receivables`: o que o usuario deve. Tambem nao entra no total
-- gasto nem na sobra do mes — o gasto e lancado em `expenses` quando pagar.
create table if not exists public.payables (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  person      text not null check (char_length(btrim(person)) between 1 and 60),
  amount      numeric(12, 2) not null check (amount > 0),
  date        date not null,
  description text not null default '' check (char_length(description) <= 120),
  -- null enquanto estiver pendente; data do pagamento quando quitado
  paid_at     date,
  created_at  timestamptz not null default now()
);

create index if not exists payables_user_idx
  on public.payables (user_id, paid_at, date desc, created_at desc);

-- ==========================================================================
--  Row Level Security
-- ==========================================================================
alter table public.categories  enable row level security;
alter table public.expenses    enable row level security;
alter table public.budgets     enable row level security;
alter table public.incomes     enable row level security;
alter table public.receivables enable row level security;
alter table public.payables    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'expenses', 'budgets', 'incomes', 'receivables', 'payables'
  ] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);

    execute format(
      'create policy "%1$s_select" on public.%1$I for select
         using (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$I for insert
         with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s_update" on public.%1$I for update
         using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$I for delete
         using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ==========================================================================
--  Categorias padrao para cada conta nova
-- ==========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, color_index)
  values
    (new.id, 'Alimentação', 0),
    (new.id, 'Transporte',  1),
    (new.id, 'Moradia',     2),
    (new.id, 'Lazer',       3),
    (new.id, 'Saúde',       4),
    (new.id, 'Educação',    5),
    (new.id, 'Outros',      6)
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
