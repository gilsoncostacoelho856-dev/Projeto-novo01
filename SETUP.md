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

A forma mais direta é a Vercel, que é gratuita para projetos pessoais (plano
Hobby). O projeto já está pronto para isso: é um app Next.js padrão, a Vercel
detecta o framework sozinha e **não é preciso nenhum arquivo de configuração**.

1. **Garanta que o código está na branch de produção.** A Vercel publica a branch
   default do repositório. Se o código ainda estiver só em uma branch de trabalho,
   mergeie o pull request antes (ou troque a branch de produção em
   *Project Settings → Git → Production Branch*).
2. Entre em <https://vercel.com> com a conta do GitHub.
3. **Add New → Project**, autorize o acesso ao repositório e clique em **Import**.
4. Em **Environment Variables**, adicione as duas variáveis do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Elas são opcionais: **sem elas o site publica e funciona em modo
   demonstração**, guardando os dados no navegador de cada visitante. Você pode
   adicioná-las depois e fazer um **Redeploy**.
5. Clique em **Deploy**. O build leva cerca de um minuto e a URL final fica no
   formato `https://SEU-PROJETO.vercel.app`.

Por fim, no Supabase, em **Authentication** → **URL Configuration**, coloque a URL
da Vercel em **Site URL** (e em **Redirect URLs**) para que os links de
confirmação de e-mail apontem para o lugar certo — sem isso, eles continuam
mandando o usuário para `localhost`.

A partir daí, cada push na branch de produção gera um novo deploy automático, e
cada pull request ganha uma URL de pré-visualização.

---

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "As tabelas ainda não foram criadas no Supabase" | Rode o passo 2 (`supabase/schema.sql`). |
| "Confirme seu e-mail antes de entrar" | Veja o passo 5, ou confirme pelo link enviado. |
| Continua aparecendo "modo demonstração" | O `.env.local` não foi lido: confira o nome do arquivo, se está na raiz e reinicie o `npm run dev`. |
| "Muitas tentativas" ao criar contas | Limite de e-mails do plano gratuito. Espere alguns minutos ou desligue a confirmação. |
| Login funciona mas nada aparece | Verifique se o script SQL rodou inteiro — sem as políticas de RLS, as consultas voltam vazias. |
| Na Vercel o site abre em modo demonstração | As variáveis de ambiente não foram adicionadas, ou foram adicionadas depois do build: adicione e clique em **Redeploy**. |
| O e-mail de confirmação leva para `localhost` | Configure a **Site URL** no Supabase com o endereço da Vercel. |
