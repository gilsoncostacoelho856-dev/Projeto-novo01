# Ligando o Supabase (banco de verdade)

Leva uns 10 minutos e o plano gratuito é suficiente. Enquanto isso não for feito,
o app funciona em **modo demonstração**, guardando tudo no navegador.

---

## 1. Criar o projeto

1. Acesse <https://supabase.com> e crie uma conta (dá para entrar com o GitHub).
2. Clique em **New project**.
3. Preencha:
   - **Name**: `minhas-financas` (ou o que preferir)
   - **Database password**: gere uma senha forte e **guarde em um gerenciador de
     senhas**. Ela é do banco, não do app — você não vai precisar dela aqui.
   - **Region**: `South America (São Paulo)` costuma ser a mais rápida no Brasil.
4. **Create new project** e espere ~2 minutos enquanto ele sobe.

## 2. Criar as tabelas

1. No menu lateral, abra **SQL Editor** → **New query**.
2. Abra o arquivo [`supabase/schema.sql`](./supabase/schema.sql) deste repositório,
   copie **todo** o conteúdo e cole no editor.
3. Clique em **Run**.

Deve aparecer *Success. No rows returned*. Isso cria as tabelas `categories`,
`expenses` e `budgets`, liga o Row Level Security nas três e configura o gatilho
que dá as sete categorias padrão a cada conta nova.

> Pode rodar de novo sem medo: o script é idempotente.

## 3. Pegar as chaves

1. **Project Settings** (engrenagem) → **API**.
2. Copie:
   - **Project URL** → vai em `NEXT_PUBLIC_SUPABASE_URL`
   - **anon** / **publishable key** → vai em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

⚠️ **Nunca** copie a chave `service_role`. Ela ignora o Row Level Security e daria
acesso aos dados de todo mundo se fosse parar no navegador.

## 4. Configurar o app

Na raiz do projeto:

```bash
cp .env.example .env.local
```

Edite o `.env.local` com os dois valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Reinicie o servidor (`Ctrl+C` e `npm run dev`). O aviso de *modo demonstração*
some da tela de login — sinal de que o Supabase assumiu.

## 5. Ajustar a confirmação de e-mail

Por padrão o Supabase exige confirmar o e-mail antes do primeiro login, e o
serviço de e-mail gratuito é limitado (poucas mensagens por hora).

- **Para testar rápido**: **Authentication** → **Sign In / Providers** → **Email**
  → desligue **Confirm email**. As contas passam a entrar direto.
- **Para uso real**: mantenha ligado e configure um SMTP próprio em
  **Project Settings** → **Authentication** → **SMTP Settings**.

O app já trata os dois casos: se a confirmação estiver ligada, ele avisa para
checar a caixa de entrada depois de criar a conta.

---

## Publicar na internet (opcional)

A forma mais direta é a Vercel, que é gratuita para projetos pessoais:

1. Suba o repositório para o GitHub.
2. Em <https://vercel.com>, **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione as mesmas duas variáveis do `.env.local`.
4. **Deploy**.

Depois, no Supabase, em **Authentication** → **URL Configuration**, coloque a URL
da Vercel em **Site URL** para que os links de confirmação de e-mail apontem para
o lugar certo.

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "As tabelas ainda não foram criadas no Supabase" | Rode o passo 2 (`supabase/schema.sql`). |
| "Confirme seu e-mail antes de entrar" | Veja o passo 5, ou confirme pelo link enviado. |
| Continua aparecendo "modo demonstração" | O `.env.local` não foi lido: confira o nome do arquivo, se está na raiz e reinicie o `npm run dev`. |
| "Muitas tentativas" ao criar contas | Limite de e-mails do plano gratuito. Espere alguns minutos ou desligue a confirmação. |
| Login funciona mas nada aparece | Verifique se o script SQL rodou inteiro — sem as políticas de RLS, as consultas voltam vazias. |
