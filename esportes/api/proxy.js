/* =====================================================================
   PROXY OPCIONAL  (funcao serverless da Vercel)

   Voce NAO precisa disto para o site funcionar. Ligue apenas se:

     (a) o navegador estiver bloqueando a API por CORS; ou
     (b) voce assinou o plano pago e nao quer a chave visivel no
         codigo do navegador (qualquer pessoa consegue ler js/config.js).

   COMO LIGAR:
     1. No painel da Vercel, em Settings > Environment Variables,
        crie THESPORTSDB_KEY com a sua chave paga.
     2. Em js/config.js, coloque proxy.ativo = true.
     3. Faca o deploy. Pronto: a chave passa a viver so no servidor e
        o navegador nunca mais a ve.

   SOBRE SEGURANCA:
   este proxy so aceita URLs da thesportsdb.com. Sem essa trava ele
   seria um proxy aberto — qualquer um poderia usar o seu dominio para
   buscar qualquer endereco da internet, e a conta (e a culpa) seria sua.
   ===================================================================== */

const HOSTS_PERMITIDOS = ['www.thesportsdb.com', 'thesportsdb.com'];

/* Cache na borda da Vercel: a mesma resposta serve varios visitantes
   sem gastar uma nova requisicao da sua chave. */
const CACHE_SEGUNDOS = 120;
const CACHE_AO_VIVO_SEGUNDOS = 25;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Use GET.' });
  }

  const alvo = req.query.alvo;
  if (!alvo) {
    return res.status(400).json({ erro: 'Faltou o parametro "alvo".' });
  }

  let url;
  try {
    url = new URL(alvo);
  } catch (e) {
    return res.status(400).json({ erro: 'O parametro "alvo" nao e uma URL valida.' });
  }

  if (url.protocol !== 'https:' || !HOSTS_PERMITIDOS.includes(url.hostname)) {
    return res.status(403).json({ erro: 'Este proxy so aceita URLs https da thesportsdb.com.' });
  }

  /* Troca a chave que veio do navegador pela chave do servidor.
     O caminho da API v1 e: /api/v1/json/{CHAVE}/recurso.php */
  const chaveServidor = process.env.THESPORTSDB_KEY;
  if (chaveServidor) {
    const partes = url.pathname.split('/');
    const iJson = partes.indexOf('json');
    if (iJson >= 0 && partes.length > iJson + 1) {
      partes[iJson + 1] = chaveServidor;
      url.pathname = partes.join('/');
    }
  }

  const ehAoVivo = url.pathname.includes('livescore');

  try {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 12000);

    const cabecalhos = { Accept: 'application/json' };
    /* A API v2 exige a chave em cabecalho, nao no caminho. */
    if (url.pathname.includes('/v2/') && chaveServidor) {
      cabecalhos['X-API-KEY'] = chaveServidor;
    }

    const resposta = await fetch(url.toString(), { headers: cabecalhos, signal: controle.signal });
    clearTimeout(relogio);

    const texto = await resposta.text();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${ehAoVivo ? CACHE_AO_VIVO_SEGUNDOS : CACHE_SEGUNDOS}, stale-while-revalidate=600`
    );

    /* Corpo vazio vira um JSON vazio para o site nao precisar tratar
       dois formatos de "nao veio nada". */
    return res.status(resposta.status).send(texto && texto.trim() ? texto : '{}');
  } catch (erro) {
    const tempoEsgotado = erro && erro.name === 'AbortError';
    return res.status(tempoEsgotado ? 504 : 502).json({
      erro: tempoEsgotado ? 'A API demorou demais para responder.' : 'Nao consegui falar com a API.',
    });
  }
}
