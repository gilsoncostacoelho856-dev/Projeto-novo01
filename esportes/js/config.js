/* =====================================================================
   CONFIGURACAO DO SITE  —  o unico arquivo que voce precisa editar

   Tudo que muda quando voce troca de plano, de esporte ou de limite
   esta aqui dentro. Nenhum outro arquivo tem chave de API escrita.
   ===================================================================== */

var CONFIG = {
  /* ------------------------------------------------------------------
     1) CHAVE DA API  —  TheSportsDB
     ------------------------------------------------------------------
     "3" e a chave de teste publica e gratuita. Ela funciona, mas tem
     limites baixos e alguns endpoints (placar ao vivo, estatisticas
     detalhadas) respondem vazio ou negam o acesso.

     QUANDO VOCE ASSINAR O PLANO PAGO:
       1. troque `chave` pela sua chave;
       2. coloque `usarV2AoVivo: true` para ligar o placar ao vivo de
          verdade (o endpoint v2 so responde com chave paga);
       3. pronto. Nada mais precisa mudar no site.

     Se voce nao quiser deixar a chave paga visivel no navegador, leia
     a secao "Escondendo a chave" do README.md: basta ligar o `proxy`
     mais abaixo e a chave passa a viver so no servidor.
     ------------------------------------------------------------------ */
  api: {
    chave: '3',

    baseV1: 'https://www.thesportsdb.com/api/v1/json',
    baseV2: 'https://www.thesportsdb.com/api/v2/json',

    // Placar ao vivo pelo endpoint v2 (exige chave paga).
    // Com `false` o site tenta o v1 e, se vier vazio, avisa na tela.
    usarV2AoVivo: false,

    // Desiste de uma requisicao que passar disso (milissegundos).
    timeoutMs: 12000,

    // Quantas vezes tenta de novo quando da erro de rede.
    tentativas: 2,

    // Espacamento minimo entre duas chamadas. Segura o site para nao
    // estourar o limite da chave gratuita. Aumente se tomar bloqueio.
    intervaloMinimoMs: 260,

    // Quantas chamadas podem estar no ar ao mesmo tempo.
    maxSimultaneas: 3,
  },

  /* ------------------------------------------------------------------
     2) PROXY OPCIONAL (serverless da Vercel)
     ------------------------------------------------------------------
     Ligue isto se: (a) o navegador bloquear a API por CORS, ou
     (b) voce quiser esconder a chave paga do publico.
     O arquivo pronto esta em `api/proxy.js`. Veja o README.
     ------------------------------------------------------------------ */
  proxy: {
    ativo: false,
    url: '/api/proxy',
  },

  /* ------------------------------------------------------------------
     3) CACHE
     ------------------------------------------------------------------
     As respostas ficam guardadas por alguns minutos para nao repetir
     chamada a toa. Tudo em sessionStorage: some quando fecha a aba.
     ------------------------------------------------------------------ */
  cache: {
    prefixo: 'esportes:cache:',
    ttlPadraoMs: 5 * 60 * 1000, // jogos, tabelas, buscas
    ttlAoVivoMs: 45 * 1000, // placar ao vivo
    ttlEstaticoMs: 60 * 60 * 1000, // time, elenco, jogador
    maxItens: 200, // acima disso descarta os mais antigos
  },

  /* ------------------------------------------------------------------
     4) ESPORTES QUE APARECEM NO FILTRO
     ------------------------------------------------------------------
     O `id` e o nome que a TheSportsDB usa. Nao traduza o `id`.
     Para tirar um esporte do site, apague a linha.
     ------------------------------------------------------------------ */
  esportes: [
    { id: 'Soccer', nome: 'Futebol', icone: '⚽' },
    { id: 'Basketball', nome: 'Basquete', icone: '🏀' },
    { id: 'Fighting', nome: 'MMA / Lutas', icone: '🥊' },
    { id: 'American Football', nome: 'Futebol Americano', icone: '🏈' },
    { id: 'Ice Hockey', nome: 'Hoquei no Gelo', icone: '🏒' },
    { id: 'Baseball', nome: 'Beisebol', icone: '⚾' },
    { id: 'Tennis', nome: 'Tenis', icone: '🎾' },
    { id: 'Motorsport', nome: 'Automobilismo', icone: '🏁' },
    { id: 'Volleyball', nome: 'Volei', icone: '🏐' },
    { id: 'Rugby', nome: 'Rugby', icone: '🏉' },
    { id: 'Handball', nome: 'Handebol', icone: '🤾' },
    { id: 'ESports', nome: 'eSports', icone: '🎮' },
  ],

  // Esporte que abre por padrao na primeira visita.
  esportePadrao: 'Soccer',

  /* ------------------------------------------------------------------
     5) LIGAS EM DESTAQUE (os atalhos da home)
     ------------------------------------------------------------------
     Aqui vai o NOME da liga, nao o numero. O site procura o nome na
     lista que a propria API devolve e descobre o id sozinho — assim
     nada quebra se a TheSportsDB mudar a numeracao.
     ------------------------------------------------------------------ */
  ligasDestaque: [
    { nome: 'Brazilian Serie A', apelido: 'Brasileirao', esporte: 'Soccer' },
    { nome: 'English Premier League', apelido: 'Premier League', esporte: 'Soccer' },
    { nome: 'Spanish La Liga', apelido: 'La Liga', esporte: 'Soccer' },
    { nome: 'Italian Serie A', apelido: 'Serie A', esporte: 'Soccer' },
    { nome: 'German Bundesliga', apelido: 'Bundesliga', esporte: 'Soccer' },
    { nome: 'French Ligue 1', apelido: 'Ligue 1', esporte: 'Soccer' },
    { nome: 'UEFA Champions League', apelido: 'Champions', esporte: 'Soccer' },
    { nome: 'Portuguese Primeira Liga', apelido: 'Portugal', esporte: 'Soccer' },
    { nome: 'NBA', apelido: 'NBA', esporte: 'Basketball' },
    { nome: 'NFL', apelido: 'NFL', esporte: 'American Football' },
    { nome: 'NHL', apelido: 'NHL', esporte: 'Ice Hockey' },
    { nome: 'MLB', apelido: 'MLB', esporte: 'Baseball' },
    { nome: 'UFC', apelido: 'UFC', esporte: 'Fighting' },
  ],

  /* ------------------------------------------------------------------
     6) ESTATISTICAS
     ------------------------------------------------------------------
     Quantos jogos entram nas contagens factuais das paginas.

     Repare no que NAO existe mais aqui: pesos de modelo, fator de
     mando, teto de confianca e odd minima. O site nao calcula mais
     probabilidade nem odd — so conta o que a API devolve. O historico
     dessa decisao esta no cabecalho de js/estatisticas.js.
     ------------------------------------------------------------------ */
  estatisticas: {
    // Quantos jogos recentes entram no retrospecto de cada equipe.
    janelaJogos: 5,

    // Quantos confrontos diretos a tabela mostra.
    janelaConfrontos: 10,
  },

  /* ------------------------------------------------------------------
     7) JOGO RESPONSAVEL  (obrigatorio — nao remova)
     ------------------------------------------------------------------ */
  responsavel: {
    idadeMinima: 18,
    chaveArmazenamento: 'esportes:idade-confirmada',
    // Quanto tempo a confirmacao de idade vale antes de perguntar de novo.
    validadeDias: 30,
    ajuda: [
      { nome: 'Jogadores Anonimos Brasil', url: 'https://www.jogadoresanonimos.com.br' },
      { nome: 'CVV — Ligue 188', url: 'https://www.cvv.org.br' },
    ],
  },

  /* ------------------------------------------------------------------
     8) INTERFACE
     ------------------------------------------------------------------ */
  ui: {
    nomeSite: 'Placar Analítico',
    fusoHorario: 'America/Sao_Paulo',
    idioma: 'pt-BR',
    // Atualiza sozinho a home a cada X ms (0 desliga).
    autoAtualizarMs: 60 * 1000,
    // Quantos jogos a home mostra antes do botao "ver mais".
    jogosPorPagina: 24,
  },
};

/* Congela para ninguem sobrescrever a chave por acidente em runtime. */
if (typeof Object.freeze === 'function') {
  Object.freeze(CONFIG.api);
}
