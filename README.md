# Minhas Finanças

Aplicativo web de **controle financeiro pessoal**: registre gastos e sua renda,
defina um limite mensal por categoria e acompanhe, em gráficos, quanto já foi
gasto contra cada limite e quanto sobra no fim do mês. Feito **mobile-first** —
a maior parte do uso acontece no celular.

## O que tem

| Tela | O que faz |
|---|---|
| **Login** (`/login`) | Entrar e criar conta com e-mail e senha |
| **Novo gasto** (`/gastos`) | Valor, categoria, data e descrição — também edita um gasto existente |
| **Orçamento** (`/orcamento`) | Limite mensal por categoria, com opção de copiar os limites do mês anterior |
| **Painel** (`/dashboard`) | Total do mês, **sobra do mês** (renda − gastos), variação vs. mês anterior, medidor de gasto × limite por categoria e gráficos |
| **Renda** (`/renda`) | Fontes de renda do mês (salário, freela, aluguel…), com opção de copiar as do mês anterior |
| **A receber** (`/a-receber`) | Quem te deve, quanto, quando e por quê — com botão para marcar como recebido |
| **Histórico** (`/historico`) | Lista filtrável por mês, categoria e busca livre; editar e excluir |
| **Categorias** (`/categorias`) | Criar, renomear, trocar a cor e excluir (movendo os gastos para outra) |

Extras: **alertas** quando uma categoria passa de 80% e de 100% do limite,
**destaque em vermelho** quando os gastos do mês passam da renda,
**categorias personalizáveis** e **tema claro/escuro** (segue o sistema e pode
ser trocado no cabeçalho).

Os valores **a receber** ficam de fora da sobra do mês de propósito: são um
lembrete de cobrança, não dinheiro que já entrou.

## Rodando o projeto

```bash
npm install
npm run dev
# abre http://localhost:3000
```

Sem nenhuma configuração o app sobe em **modo demonstração**: os dados ficam no
`localStorage` do navegador e há uma conta de exemplo já populada
(`demo@financas.app` / `demo1234`) — o botão *Entrar com a conta de exemplo*
aparece na tela de login.

Para usar um banco de verdade (Supabase gratuito), siga o
**[SETUP.md](./SETUP.md)**. Assim que `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` existirem no `.env.local`, o app passa a usar o
Supabase automaticamente — nenhuma mudança de código.

Outros comandos:

```bash
npm run build      # build de produção
npm run typecheck  # checagem de tipos
npm start          # serve o build
```

## Como está organizado

```
src/
├── app/
│   ├── layout.tsx            # providers + script que aplica o tema sem flash
│   ├── login/                # entrar / criar conta
│   └── (app)/                # área autenticada (guarda de sessão + moldura)
│       ├── dashboard/  gastos/  orcamento/  historico/  categorias/
│       └── renda/  a-receber/
├── components/
│   ├── AppShell.tsx          # nav inferior no celular, lateral no desktop
│   ├── charts/               # BudgetMeter, DailyColumns, CategoryStack
│   ├── CurrencyInput.tsx     # campo de dinheiro em pt-BR
│   └── ui.tsx  icons.tsx     # primitivas visuais
└── lib/
    ├── data/                 # back-ends intercambiáveis
    │   ├── supabase.ts       #   → Supabase (auth + tabelas com RLS)
    │   ├── demo.ts           #   → localStorage (modo demonstração)
    │   └── index.ts          #   → escolhe um dos dois
    ├── finance-context.tsx   # estado do app (sessão, mês, dados, mutações)
    ├── derive.ts             # gasto × limite, sobra do mês, situação, série diária
    ├── format.ts             # moeda e datas em pt-BR, sem desvio de fuso
    └── types.ts              # modelos + contrato `DataAdapter`
```

O ponto central é o **`DataAdapter`** (`src/lib/types.ts`): as telas nunca falam
com o Supabase direto. Trocar de back-end é implementar essa interface.

## Decisões de design

**Gráficos.** São três formas, cada uma escolhida pelo trabalho que o dado
precisa fazer:

- *gasto × limite por categoria* → **medidor** (uma razão contra um teto lê melhor
  que uma barra dupla). A cor do preenchimento carrega a severidade
  (acento → alerta → crítico) e vem sempre com ícone e rótulo em texto, para que
  nada dependa só de cor;
- *gastos por dia* → **colunas** de série única, um tom só, com rótulo direto
  apenas no maior dia;
- *para onde foi o dinheiro* → **barra empilhada** horizontal, com legenda
  rotulada, valores e uma visão em tabela.

**Paleta.** Oito cores categóricas em ordem fixa (nunca cicladas), validadas nos
dois temas para banda de luminosidade, croma, contraste e separação sob
daltonismo (protanopia/deuteranopia/tritanopia). Os tokens ficam em
`src/app/globals.css`; as cores de status (bom/alerta/crítico) são reservadas e
nunca viram "cor de série". Quando há mais de oito categorias com gasto, a cauda
vira "Outras" em cinza — nenhuma cor nova é gerada.

**Mobile-first.** Navegação inferior no celular e lateral no desktop, alvos de
toque de 44px, campos com fonte de 16px (evita o zoom automático do Safari),
área segura do iPhone respeitada e teclado numérico no campo de valor.

## Segurança

- No Supabase, todas as tabelas têm **Row Level Security** e cada política compara
  `auth.uid()` com `user_id`: mesmo com a chave pública no navegador, um usuário
  só lê e escreve as próprias linhas.
- Só a chave **anon/publishable** vai para o cliente. A `service_role` nunca deve
  entrar em variável `NEXT_PUBLIC_*`.
- O **modo demonstração** guarda a senha em texto puro no `localStorage`. Ele
  existe para você ver o app funcionando sem configurar nada — não use com dados
  reais.
