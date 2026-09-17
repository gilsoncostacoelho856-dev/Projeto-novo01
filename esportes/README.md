# Placar Analítico

Site de análise estatística esportiva em **HTML, CSS e JavaScript puro**. Sem framework, sem build, sem
`npm install`. É só abrir o arquivo no navegador ou jogar a pasta em qualquer hospedagem.

Os dados vêm da [TheSportsDB](https://www.thesportsdb.com/api.php).

---

## O que o site faz

| Página | Arquivo | O que tem |
|---|---|---|
| Jogos | `index.html` | Próximos jogos, jogos ao vivo, filtros por esporte / competição / data |
| Análise da partida | `analise.html` | Confrontos diretos, forma recente dos dois times, probabilidades e sugestões |
| Apostas do dia | `apostas.html` | Analisa os jogos do dia e ordena as seleções por índice de confiança |
| Time | `time.html` | Ficha, forma recente, elenco, últimos resultados, próximos jogos |
| Jogador | `jogador.html` | Ficha completa do atleta |
| Times | `times.html` | Busca por nome ou por competição |

Está tudo em 12 esportes (futebol, basquete, MMA, futebol americano, hóquei, beisebol, tênis,
automobilismo, vôlei, rúgbi, handebol e eSports). A lista fica em `js/config.js` e você edita à vontade.

---

## ⚠️ Antes de qualquer coisa: o que este site NÃO faz

**Ele não acerta 90% a 100% das apostas. Nenhum site acerta, e quem promete isso está mentindo.**

Se um modelo estatístico tivesse esse acerto, as casas de apostas teriam quebrado há muito tempo. O que
existe de verdade neste projeto é um **índice de confiança**: a probabilidade calculada por um modelo,
ajustada pela quantidade de dados disponíveis e limitada a um teto (padrão: 92%). Esse teto está em
`js/config.js` e foi posto de propósito — sempre existe zebra, lesão, expulsão e time reserva, e nada
disso entra em conta nenhuma.

O número grande no bilhete (`1,46`) também **não é a odd da bet365 nem de nenhuma casa**. A TheSportsDB não
fornece odds. Aquilo é a **odd justa** do modelo: o inverso da probabilidade calculada.

**É assim que você usa:**

| Situação | O que significa |
|---|---|
| Casa paga **acima** da odd justa | O preço está a seu favor — é o que se chama aposta de valor |
| Casa paga **abaixo** da odd justa | A vantagem é da casa |

Ou seja: o site não te diz em que apostar. Ele te dá uma referência de preço para você comparar com a casa.

---

## Como rodar no seu computador

**Opção 1 — abrir direto.** Dê dois cliques em `index.html`. Funciona, mas alguns navegadores bloqueiam
chamadas de API em arquivos abertos por `file://`.

**Opção 2 — servidor local (recomendado).** Dentro da pasta `esportes/`:

```bash
# com Python (já vem instalado no Mac e no Linux)
python3 -m http.server 8000

# ou com Node
npx serve .
```

Depois abra `http://localhost:8000`.

---

## 🔑 Trocando a chave da API

Tudo que diz respeito à chave está em **um arquivo só: `js/config.js`**. Nenhum outro arquivo do projeto
tem chave escrita.

```js
api: {
  chave: '3',            // <-- troque aqui
  usarV2AoVivo: false,   // <-- ligue em true quando tiver plano pago
  ...
}
```

### O que muda quando você assina o plano pago

A chave de teste `"3"` é pública e gratuita, mas tem limites duros. Com ela:

| Recurso | Chave `"3"` | Plano pago |
|---|---|---|
| Próximos jogos e resultados | ✅ funciona | ✅ |
| Times, escudos, estádios | ✅ funciona | ✅ |
| Confrontos diretos | ✅ funciona | ✅ |
| **Placar ao vivo** | ❌ vem vazio | ✅ |
| **Elenco completo** | ⚠️ às vezes vazio | ✅ |
| **Tabela de classificação** | ⚠️ instável | ✅ |

Quando um recurso não vem, o site **não quebra** — ele mostra um aviso explicando que aquilo depende do
plano pago. Assim que você trocar a chave, tudo passa a funcionar sem mexer em mais nada.

Para ligar o placar ao vivo de verdade:

```js
chave: 'sua-chave-aqui',
usarV2AoVivo: true,
```

### Escondendo a chave paga (opcional)

Qualquer pessoa consegue ler `js/config.js` no navegador. Se você não quiser expor a chave paga, o projeto
já vem com um proxy pronto em `api/proxy.js`:

1. No painel da Vercel: **Settings → Environment Variables** → crie `THESPORTSDB_KEY` com a sua chave.
2. Em `js/config.js`, mude para `proxy: { ativo: true, url: '/api/proxy' }`.
3. Faça o deploy.

A partir daí a chave vive só no servidor. O proxy só aceita URLs da `thesportsdb.com` — sem essa trava
ele viraria um proxy aberto e qualquer um poderia usar o seu domínio para buscar qualquer coisa.

O mesmo proxy resolve problema de CORS, caso o navegador bloqueie as chamadas diretas.

---

## 🚀 Como publicar (deploy)

O site é estático. Qualquer hospedagem serve. Três caminhos, do mais fácil para o mais trabalhoso.

### Vercel (recomendado — é o que o `vercel.json` já configura)

**Pelo site, sem instalar nada:**

1. Entre em [vercel.com](https://vercel.com) e faça login com a sua conta do GitHub.
2. **Add New → Project** e escolha o repositório `Projeto-novo01`.
3. ⚠️ **O passo que as pessoas erram:** em **Root Directory**, clique em *Edit* e escolha a pasta
   **`esportes`**. Sem isso a Vercel tenta publicar a raiz do repositório, que tem outro projeto dentro.
4. Framework Preset: **Other**. Build Command: deixe vazio. Output Directory: deixe vazio.
5. **Deploy**.

Em menos de um minuto você recebe uma URL tipo `seu-projeto.vercel.app`. Todo `git push` na branch publica
sozinho a partir daí.

**Pelo terminal:**

```bash
npm i -g vercel
cd esportes
vercel          # pré-visualização
vercel --prod   # publica de verdade
```

### Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Escolha o repositório.
3. **Base directory:** `esportes` · **Build command:** deixe vazio · **Publish directory:** `esportes`.
4. Deploy.

Mais rápido ainda: arraste a pasta `esportes/` inteira para a área de "drag and drop" do Netlify. Publica
na hora, sem nem conectar o GitHub. (O proxy de `api/proxy.js` não funciona nesse modo — ele é escrito no
formato da Vercel.)

### GitHub Pages

1. No repositório: **Settings → Pages**.
2. **Source:** Deploy from a branch. **Branch:** a sua branch, pasta `/root`.
3. Salve. O site sai em `https://SEU-USUARIO.github.io/Projeto-novo01/esportes/`.

Como a pasta fica dentro do caminho, confira se os links continuam certos — todos os caminhos do projeto
são relativos (`css/base.css`, e não `/css/base.css`), então deve funcionar direto. O proxy serverless
não existe no GitHub Pages.

### Domínio próprio

Nas três, é o mesmo caminho: **Settings → Domains → Add**, e depois apontar o DNS do seu domínio para o
serviço. Tanto Vercel quanto Netlify emitem o certificado HTTPS de graça e sozinhos.

---

## Como o modelo funciona

Está todo em `js/modelo.js`, comentado em português.

1. **Forma recente** — os últimos 5 jogos viram pontos (V=3, E=1, D=0), com o jogo mais recente pesando
   mais que o mais antigo.
2. **Confrontos diretos** — o mesmo cálculo, mas só nos jogos entre as duas equipes.
3. **Ataque e defesa** — média de gols feitos e sofridos, separando jogos em casa de jogos fora.
4. **Poisson** — com essas médias, o modelo estima os gols esperados de cada lado e monta uma matriz com a
   probabilidade de cada placar (de 0×0 até 8×8). Somar as células certas dá a probabilidade de qualquer
   mercado. É o mesmo ponto de partida que as casas de apostas usam.
5. **Índice de confiança** — a probabilidade, puxada na direção de 50% conforme a amostra é pequena. Cinco
   jogos é pouca informação, e o número reflete isso em vez de fingir certeza.

### Sobre as combinações "Criar Aposta"

Quando o site junta duas seleções do mesmo jogo, ele **não multiplica as odds**. Multiplicar trataria
"Flamengo vence" e "mais de 2,5 gols" como eventos independentes — e eles não são: um time que vence
tende a marcar mais. Como a matriz de placares já tem a probabilidade de cada resultado, o site soma
exatamente as células onde as duas condições acontecem juntas.

Na prática, num exemplo real do projeto: multiplicação ingênua daria odd **1,54**; a probabilidade
conjunta correta dá **1,46**. Quem multiplica está superestimando o próprio retorno.

O modelo também descarta combinações onde uma seleção já está contida na outra (por exemplo "Flamengo
vence" + "Flamengo marca" — vencer já obriga marcar). A casa não paga nada a mais por isso.

### Mexendo nos parâmetros

Tudo em `js/config.js`:

```js
modelo: {
  pesos: { forma: 0.45, confrontos: 0.28, gols: 0.27 },  // precisa somar 1
  fatorCasa: 1.12,          // 1.12 = mandante ganha 12% de força
  confiancaMaxima: 92,      // teto do índice
  confiancaMinima: 55,      // abaixo disso não sugere
  maxJogosAnalisados: 12,   // suba só com plano pago: cada jogo custa ~3 chamadas
},
apostas: {
  oddMinima: 1.30,          // corta as sugestões óbvias demais
  maxPernasCombo: 3,
},
```

---

## Requisitos de responsabilidade (não remova)

Estes dois itens são obrigatórios e estão implementados:

**1. Verificação de idade 18+.** Um script no `<head>` de cada página marca o documento como bloqueado
*antes* de qualquer pixel aparecer, e o CSS esconde todo o conteúdo enquanto a marca existir. Não há
piscada de conteúdo liberado, e fechar o modal pelo inspetor não ajuda — o conteúdo continua escondido
pelo CSS. A confirmação vale 30 dias (`responsavel.validadeDias`).

**2. Aviso fixo de jogo responsável.** Barra presa no rodapé, em todas as páginas, em todos os tamanhos de
tela, com link para o [Jogadores Anônimos Brasil](https://www.jogadoresanonimos.com.br). O rodapé completo
traz também o CVV (188).

Além da obrigação, vale o lembrete prático: apostas são proibidas para menores de 18 anos no Brasil, e
prometer índice de acerto garantido é propaganda enganosa pelo Código de Defesa do Consumidor e pela Lei
14.790/2023.

---

## Estrutura dos arquivos

```
esportes/
├── index.html            Jogos do dia + ao vivo
├── analise.html          Análise de uma partida
├── apostas.html          Apostas do dia
├── time.html             Detalhes do time
├── jogador.html          Detalhes do jogador
├── times.html            Busca de times
│
├── css/
│   ├── base.css          Cores, layout, cabeçalho, rodapé, portão 18+
│   └── componentes.css   Cards, bilhetes, barras, tabelas, estados
│
├── js/
│   ├── config.js         ⭐ CHAVE DA API e todos os ajustes
│   ├── cache.js          Cache com validade (não estoura o limite grátis)
│   ├── api.js            Camada da TheSportsDB: fila, timeout, normalização
│   ├── modelo.js         Poisson, forma, confrontos, combinações
│   ├── ui.js             Criação de elementos, datas, cards, estados
│   ├── bilhete.js        O bilhete de aposta
│   ├── layout.js         Cabeçalho, rodapé e o portão 18+
│   ├── home.js           · apostas.js · analise.js
│   └── time.js           · jogador.js  · times.js
│
├── api/
│   └── proxy.js          Proxy serverless opcional (Vercel)
│
├── vercel.json           Configuração de deploy e cabeçalhos
└── README.md
```

---

## Detalhes técnicos que talvez te interessem

**Cache.** Toda resposta da API fica guardada em `sessionStorage` com prazo de validade: 5 minutos para
jogos, 45 segundos para placar ao vivo, 1 hora para dados de time e jogador. Se a API cair e existir uma
cópia vencida, o site mostra a cópia com um aviso amarelo em vez de uma tela de erro.

**Fila de requisições.** As chamadas saem espaçadas em 260 ms, no máximo 3 ao mesmo tempo. É o que impede
a página de apostas de disparar 30 requisições de uma vez e tomar bloqueio.

**Erros.** Cada seção trata o próprio erro. Se o placar ao vivo falhar, os jogos do dia continuam
aparecendo; se o elenco falhar, o resto da página do time continua lá.

**Nomes de campo.** A TheSportsDB renomeou campos ao longo dos anos (`strTeamBadge` virou `strBadge`, por
exemplo). O `api.js` aceita os dois nomes, então o site não quebra com qualquer versão da API.

**Ligas por nome, não por número.** Os atalhos de competição procuram a liga **pelo nome** na lista que a
própria API devolve, em vez de depender de IDs fixos que podem mudar.

**Segurança.** Nenhum HTML é montado por concatenação de texto — tudo é `createElement` + `textContent`.
Nome de time vindo da API nunca vira código executável na página.

**Imagens.** Link de escudo quebrado é comum na TheSportsDB. Quando a imagem falha, o site desenha um
círculo com as iniciais do time no lugar.

---

## Limitações honestas da fonte de dados

Para você não perder tempo procurando o que não existe:

- **Não há odds.** Nenhuma. A odd mostrada é sempre calculada pelo modelo.
- **Não há estatística individual de jogador** (gols na temporada, assistências, minutos) na chave
  gratuita. A TheSportsDB é um banco de fichas, não de desempenho.
- **Não há chutes, escanteios, posse de bola ou cartões.** Então mercados do tipo "mais de 5,5 chutes no
  primeiro tempo" são impossíveis com esta fonte — precisaria de outra API (Sportmonks, API-Football,
  Opta), todas pagas.
- **Cobertura irregular fora do futebol.** MMA e eSports costumam vir com menos dados históricos, e o
  modelo avisa quando a amostra é pequena.

---

## Licença e uso

Projeto de uso informativo e educacional. Não aceita apostas, não intermedeia pagamento e não vende
palpite. Os dados são da TheSportsDB, sujeitos aos termos de uso dela.
