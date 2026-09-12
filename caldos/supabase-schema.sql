-- =====================================================================
-- Delivery de Caldos — banco de dados do MODO NUVEM (Supabase)
-- ---------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do seu projeto Supabase e
-- clique em RUN. Pode rodar de novo quantas vezes quiser: tudo aqui e
-- idempotente (nao duplica nada e nao apaga o que voce cadastrou).
--
-- Regra de acesso, em uma frase: QUALQUER PESSOA PODE LER o cardapio
-- (e o site do cliente precisa disso) e SOMENTE QUEM ESTA LOGADO pode
-- criar, mudar ou excluir.
-- =====================================================================

-- ------------------------------------------------------------ tabelas

-- Uma unica linha (id = 1) com os dados da loja.
create table if not exists public.loja (
  id            smallint primary key default 1,
  nome          text    not null default 'Delivery de Caldos',
  banner_titulo text    not null default '',
  banner_texto  text    not null default '',
  whatsapp      text    not null default '',
  horario       text    not null default '',
  area_entrega  text    not null default '',
  taxa_entrega  numeric(10, 2) not null default 0,
  atualizado_em timestamptz not null default now(),
  constraint loja_linha_unica check (id = 1)
);

create table if not exists public.itens (
  id         text primary key,
  nome       text    not null,
  preco      numeric(10, 2) not null default 0,
  descricao  text    not null default '',
  foto       text    not null default '',
  ativo      boolean not null default true,
  ordem      integer not null default 1,
  criado_em  timestamptz not null default now()
);

create index if not exists itens_ordem_idx on public.itens (ordem);

-- Cria a linha da loja na primeira vez, sem sobrescrever depois.
insert into public.loja (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------- permissoes dos papeis
-- Sem estes grants o Supabase responde "permission denied for table".

grant usage on schema public to anon, authenticated;
grant select on public.loja, public.itens to anon, authenticated;
grant insert, update, delete on public.loja, public.itens to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.loja  enable row level security;
alter table public.itens enable row level security;

-- `drop policy if exists` antes de cada `create policy` e o que deixa o
-- arquivo poder rodar mais de uma vez.

drop policy if exists "loja: leitura publica" on public.loja;
create policy "loja: leitura publica"
  on public.loja for select
  using (true);

drop policy if exists "loja: escrita autenticada" on public.loja;
create policy "loja: escrita autenticada"
  on public.loja for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "itens: leitura publica" on public.itens;
create policy "itens: leitura publica"
  on public.itens for select
  using (true);

drop policy if exists "itens: escrita autenticada" on public.itens;
create policy "itens: escrita autenticada"
  on public.itens for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------- fotos (Storage)
-- Balde publico para as fotos dos caldos.

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos: leitura publica" on storage.objects;
create policy "fotos: leitura publica"
  on storage.objects for select
  using (bucket_id = 'fotos');

drop policy if exists "fotos: envio autenticado" on storage.objects;
create policy "fotos: envio autenticado"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fotos');

drop policy if exists "fotos: troca autenticada" on storage.objects;
create policy "fotos: troca autenticada"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos');

drop policy if exists "fotos: exclusao autenticada" on storage.objects;
create policy "fotos: exclusao autenticada"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos');
