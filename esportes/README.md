# Placar Analítico

Site de consulta de jogos, times e resultados esportivos em **HTML, CSS e JavaScript puro**. Sem framework, sem build, sem
`npm install`. É só abrir o arquivo no navegador ou jogar a pasta em qualquer hospedagem.

Os dados vêm da [TheSportsDB](https://www.thesportsdb.com/api.php).

---

## O que o site faz

| Página | Arquivo | O que tem |
|---|---|---|
| Jogos | `index.html` | Próximos jogos, jogos ao vivo, filtros por esporte / competição / data |
| Comparação | `analise.html` | Confrontos diretos e retrospecto recente das duas equipes |
| Time | `time.html` | Ficha, retrospecto recente, elenco, últimos resultados, próximos jogos |
| Jogador | `jogador.html` | Ficha completa do atleta |
| Times | `times.html` | Busca por nome ou por competição |

Está tudo em 12 esportes (futebol, basquete, MMA, futebol americano, hóquei, beisebol, tênis,
automobilismo, vôlei, rúgbi, handebol e eSports). A lista fica em `js/config.js` e você edita à vontade.

---

## ⚠️ O que este site NÃO faz

**Ele não indica apostas, não calcula probabilidade e não exibe odd.** Mostra o que a TheSportsDB
registrou: quem jogou, quando, qual foi o placar, e a contagem desses placares.

Uma versão anterior deste site calculava probabilidade por distribuição de Poisson, derivava uma "odd
justa" (1 ÷ probabilidade) e exibia um "índice de confiança". A matemática era real e os dados também —
mas **o modelo nunca foi calibrado**: ninguém jamais verificou se aquilo que ele chamava de 62%
acontecia 62% das vezes. Os pesos eram escolhidos no olho, a amostra era de 5 jogos, e o índice de
confiança era uma fórmula sem respaldo em método publicado.

Número não calibrado, exibido com casa decimal, ao lado do nome de um time, empresta uma autoridade que
ele não tem. Quem lê pode perder dinheiro de verdade por causa disso. Por isso saiu.

### Se você quiser projeção de volta um dia

O caminho honesto tem três etapas, nesta ordem:

1. **Fonte com histórico longo** — temporadas inteiras, não os 5 jogos que a chave gratuita devolve.
2. **Backtest** — rodar o modelo sobre jogos passados e medir se as previsões bateram com o que
   aconteceu. Sem isso, qualquer percentual é opinião formatada como número.
3. **Só então exibir** — e exibindo junto o resultado do backtest, para o leitor saber o que o número vale.

Pular a etapa 2 é o que transforma estatística em adivinhação com aparência de ciência.

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

## Como as contagens funcionam

Está tudo em `js/estatisticas.js`, e é aritmética simples de propósito — você consegue conferir na mão.

- **Retrospecto recente** — conta vitórias, empates e derrotas nos últimos jogos com placar registrado.
  Sem peso por antiguidade: um jogo é um jogo. Vira a frase que aparece na tela, do tipo
  *"Palmeiras venceu 1, empatou 1 e perdeu 3 dos últimos 5 jogos."*
- **Gols por mando** — média simples de gols feitos e sofridos, separando jogos em casa de jogos fora.
  Quando não há nenhum jogo de um dos tipos, mostra um traço em vez de repetir a média geral: sem jogo
  não existe média.
- **Confrontos diretos** — conta o histórico entre as duas equipes. Como o mandante muda a cada
  confronto, o placar é lido do ponto de vista da equipe certa, senão a contagem sairia errada nos jogos
  disputados no campo do adversário.

Em toda página, a **lista dos jogos usados fica logo abaixo da contagem**. Isso é intencional: é o que
permite conferir se o número está certo, em vez de ter que confiar nele.

Não existe campo "favorito", "chance" ou "indicação" em lugar nenhum. A leitura de quem está melhor fica
com quem olha a tabela — que é onde ela deve ficar.

### Ajustando

Em `js/config.js`:

```js
estatisticas: {
  janelaJogos: 5,        // quantos jogos entram no retrospecto
  janelaConfrontos: 10,  // quantos confrontos diretos a tabela mostra
},
```

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
├── analise.html          Comparação entre as duas equipes
├── time.html             Detalhes do time
├── jogador.html          Detalhes do jogador
├── times.html            Busca de times
│
├── css/
│   ├── base.css          Cores, layout, cabeçalho, rodapé, portão 18+
│   └── componentes.css   Cards, painéis, tabelas, estados
│
├── js/
│   ├── config.js         ⭐ CHAVE DA API e todos os ajustes
│   ├── cache.js          Cache com validade (não estoura o limite grátis)
│   ├── api.js            Camada da TheSportsDB: fila, timeout, normalização
│   ├── estatisticas.js   Contagens factuais: retrospecto, gols, confrontos
│   ├── ui.js             Criação de elementos, datas, cards, estados
│   ├── layout.js         Cabeçalho, rodapé e o portão 18+
│   ├── home.js           · analise.js
│   └── time.js           · jogador.js · times.js
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

- **Não há odds.** Nenhuma, em lugar nenhum da API — e o site não inventa nenhuma.
- **Não há estatística individual de jogador** (gols na temporada, assistências, minutos) na chave
  gratuita. A TheSportsDB é um banco de fichas, não de desempenho.
- **Não há chutes, escanteios, posse de bola ou cartões.** Então mercados do tipo "mais de 5,5 chutes no
  primeiro tempo" são impossíveis com esta fonte — precisaria de outra API (Sportmonks, API-Football,
  Opta), todas pagas.
- **Cobertura irregular fora do futebol.** MMA e eSports costumam vir com menos dados históricos; onde
  não há jogo registrado, a página diz isso em vez de mostrar zero.
- **Só 5 jogos por equipe** na chave gratuita. É pouco para qualquer conclusão forte, e é exatamente por
  isso que o site se limita a contar em vez de projetar.

---

## Licença e uso

Projeto de uso informativo e educacional. Não aceita apostas, não intermedeia pagamento, não vende
palpite e não indica em que apostar. Os dados são da TheSportsDB, sujeitos aos termos de uso dela.
