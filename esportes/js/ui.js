/* =====================================================================
   UTILITARIOS DE INTERFACE
   Criacao de elementos, formatacao de data, cards de partida e os
   estados de tela (carregando / vazio / erro).

   Regra deste arquivo: nada aqui monta HTML com string concatenada.
   Tudo e `createElement` + `textContent`, entao nome de time vindo da
   API nunca vira HTML executavel.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;

  /* ================================================================
     ELEMENTOS
     ================================================================ */

  function $(sel, raiz) {
    return (raiz || document).querySelector(sel);
  }

  function $$(sel, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(sel));
  }

  /**
   * criar('div.card.destaque', 'texto')  ou
   * criar('a', { href: '#', class: 'btn' }, 'texto')
   */
  function criar(tag, attrsOuTexto, texto) {
    var classes = [];
    var nome = tag;

    if (tag.indexOf('.') > 0) {
      var partes = tag.split('.');
      nome = partes.shift();
      classes = partes;
    }

    var el = document.createElement(nome);
    if (classes.length) el.className = classes.join(' ');

    if (attrsOuTexto && typeof attrsOuTexto === 'object') {
      Object.keys(attrsOuTexto).forEach(function (k) {
        var v = attrsOuTexto[k];
        if (v === null || v === undefined) return;
        if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k === 'onclick') el.addEventListener('click', v);
        else el.setAttribute(k, v);
      });
      if (texto !== undefined && texto !== null) el.textContent = texto;
    } else if (attrsOuTexto !== undefined && attrsOuTexto !== null) {
      el.textContent = attrsOuTexto;
    }

    return el;
  }

  function limpar(el) {
    if (!el) return el;
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function anexar(pai) {
    for (var i = 1; i < arguments.length; i++) {
      var f = arguments[i];
      if (f) pai.appendChild(f);
    }
    return pai;
  }

  /* ================================================================
     DATA E HORA
     ================================================================ */

  var fusoOpcoes = { timeZone: C.ui.fusoHorario };

  function formatarHora(data) {
    if (!data) return '--:--';
    try {
      return new Intl.DateTimeFormat(C.ui.idioma, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: C.ui.fusoHorario,
      }).format(data);
    } catch (e) {
      return data.toTimeString().slice(0, 5);
    }
  }

  function formatarData(data, longo) {
    if (!data) return '--';
    try {
      return new Intl.DateTimeFormat(
        C.ui.idioma,
        longo
          ? { weekday: 'long', day: '2-digit', month: 'long', timeZone: C.ui.fusoHorario }
          : { day: '2-digit', month: '2-digit', timeZone: C.ui.fusoHorario }
      ).format(data);
    } catch (e) {
      return data.toISOString().slice(0, 10);
    }
  }

  /** "Hoje, 16:30" / "Amanha, 21:00" / "sab, 12/10 16:30" */
  function quandoAmigavel(data) {
    if (!data) return 'Data a definir';

    var hoje = new Date();
    var d1 = diaISO(data);
    var d0 = diaISO(hoje);
    var amanha = new Date(hoje.getTime() + 86400000);
    var ontem = new Date(hoje.getTime() - 86400000);

    if (d1 === d0) return 'Hoje, ' + formatarHora(data);
    if (d1 === diaISO(amanha)) return 'Amanhã, ' + formatarHora(data);
    if (d1 === diaISO(ontem)) return 'Ontem, ' + formatarHora(data);

    try {
      return new Intl.DateTimeFormat(C.ui.idioma, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: C.ui.fusoHorario,
      }).format(data);
    } catch (e) {
      return formatarData(data) + ' ' + formatarHora(data);
    }
  }

  /** Data no formato YYYY-MM-DD respeitando o fuso configurado. */
  function diaISO(data) {
    var d = data || new Date();
    try {
      var partes = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: C.ui.fusoHorario,
      }).format(d);
      return partes;
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function somarDias(dataISO, dias) {
    var d = new Date(dataISO + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  /* ================================================================
     IMAGENS
     ================================================================ */

  /** A TheSportsDB serve uma versao leve com /preview no fim da URL. */
  function miniatura(url) {
    if (!url) return '';
    if (url.indexOf('thesportsdb.com') < 0) return url;
    if (/\/preview$/.test(url)) return url;
    return url + '/preview';
  }

  /**
   * Escudo com plano B: se a imagem falhar (link morto e comum na API),
   * troca por um circulo com as iniciais do time.
   */
  function escudo(url, nome, tamanho) {
    var caixa = criar('span.escudo');
    if (tamanho) caixa.style.setProperty('--tam', tamanho + 'px');

    var iniciais = criar('span.escudo-iniciais', abreviar(nome));
    caixa.appendChild(iniciais);

    if (url) {
      var img = criar('img', {
        src: miniatura(url),
        alt: '',
        loading: 'lazy',
        decoding: 'async',
      });
      img.addEventListener('error', function () {
        img.remove();
      });
      img.addEventListener('load', function () {
        iniciais.style.display = 'none';
      });
      caixa.appendChild(img);
    }

    return caixa;
  }

  function abreviar(nome) {
    var n = String(nome || '?').trim().split(/\s+/);
    if (n.length === 1) return n[0].slice(0, 3).toUpperCase();
    return (n[0][0] + n[n.length - 1][0]).toUpperCase();
  }

  /* ================================================================
     ESTADOS DE TELA
     ================================================================ */

  function carregando(quantos, tipo) {
    var caixa = criar('div.grade');
    for (var i = 0; i < (quantos || 6); i++) {
      caixa.appendChild(criar('div.esqueleto' + (tipo ? '.esqueleto-' + tipo : '')));
    }
    return caixa;
  }

  function vazio(titulo, detalhe, acao) {
    var caixa = criar('div.estado');
    caixa.appendChild(criar('div.estado-icone', '📭'));
    caixa.appendChild(criar('h3.estado-titulo', titulo || 'Nada por aqui'));
    if (detalhe) caixa.appendChild(criar('p.estado-texto', detalhe));
    if (acao) caixa.appendChild(acao);
    return caixa;
  }

  function erro(mensagem, aoTentarDeNovo) {
    var caixa = criar('div.estado.estado-erro');
    caixa.appendChild(criar('div.estado-icone', '⚠️'));
    caixa.appendChild(criar('h3.estado-titulo', 'Não consegui carregar'));
    caixa.appendChild(criar('p.estado-texto', mensagem || 'Tente novamente em instantes.'));

    if (aoTentarDeNovo) {
      var botao = criar('button.btn.btn-contorno', { type: 'button' }, 'Tentar de novo');
      botao.addEventListener('click', aoTentarDeNovo);
      caixa.appendChild(botao);
    }
    return caixa;
  }

  /** Faixa amarela de "estou mostrando dado velho porque a API caiu". */
  function avisoDados(texto) {
    var caixa = criar('div.faixa-aviso');
    caixa.appendChild(criar('span', '⚠️'));
    caixa.appendChild(criar('span', texto));
    return caixa;
  }

  function avisoPremium(texto) {
    var caixa = criar('div.faixa-aviso.faixa-premium');
    caixa.appendChild(criar('span', '🔒'));
    caixa.appendChild(
      criar(
        'span',
        texto || 'Este dado exige o plano pago da TheSportsDB. Troque a chave em js/config.js para liberar.'
      )
    );
    return caixa;
  }

  /* ================================================================
     CARD DE PARTIDA
     ================================================================ */

  /**
   * @param {Object} ev      evento ja normalizado pelo api.js
   * @param {Object} opcoes  { comAnalise: bool }
   */
  function cardJogo(ev, opcoes) {
    opcoes = opcoes || {};

    var card = criar('article.card-jogo');
    if (ev.aoVivo) card.classList.add('ao-vivo');

    /* --- topo: liga + status --- */
    var topo = criar('header.card-topo');
    topo.appendChild(criar('span.card-liga', ev.liga || ev.esporte || ''));
    topo.appendChild(selo(ev));
    card.appendChild(topo);

    /* --- times --- */
    var corpo = criar('div.card-times');
    corpo.appendChild(ladoDoTime(ev.casa, ev.placarCasa, ev));
    corpo.appendChild(criar('div.card-versus', ev.temPlacar ? '×' : 'vs'));
    corpo.appendChild(ladoDoTime(ev.fora, ev.placarFora, ev));
    card.appendChild(corpo);

    /* --- rodape: horario, local e botao de analise --- */
    var pe = criar('footer.card-pe');

    var info = criar('div.card-info');
    info.appendChild(criar('span.card-hora', quandoAmigavel(ev.quando)));
    if (ev.local) info.appendChild(criar('span.card-local', ev.local));
    pe.appendChild(info);

    if (opcoes.comAnalise !== false) {
      var link = criar(
        'a.btn.btn-mini',
        { href: 'analise.html?evento=' + encodeURIComponent(ev.id) },
        'Ver análise'
      );
      pe.appendChild(link);
    }

    card.appendChild(pe);
    return card;
  }

  function ladoDoTime(time, placar, ev) {
    var lado = criar('div.card-time');

    var alvo = time.id ? 'time.html?id=' + encodeURIComponent(time.id) : null;
    var caixa = alvo ? criar('a.card-time-link', { href: alvo }) : criar('div.card-time-link');

    caixa.appendChild(escudo(time.escudo, time.nome, 44));
    caixa.appendChild(criar('span.card-time-nome', time.nome || '—'));
    lado.appendChild(caixa);

    if (placar !== null && placar !== undefined) {
      lado.appendChild(criar('span.card-placar', String(placar)));
    }

    return lado;
  }

  function selo(ev) {
    if (ev.adiado) return criar('span.selo.selo-cinza', 'Adiado');
    if (ev.aoVivo) {
      var s = criar('span.selo.selo-vivo');
      s.appendChild(criar('span.ponto-vivo'));
      s.appendChild(criar('span', ev.status && ev.status.length <= 4 ? ev.status : 'AO VIVO'));
      return s;
    }
    if (ev.encerrado) return criar('span.selo.selo-cinza', 'Encerrado');
    return criar('span.selo', formatarHora(ev.quando));
  }

  /* ================================================================
     FORMA RECENTE  (as bolinhas V / E / D)
     ================================================================ */

  function tiraDeForma(sequencia) {
    var caixa = criar('div.tira-forma');
    if (!sequencia || !sequencia.length) {
      caixa.appendChild(criar('span.forma-vazio', 'sem dados'));
      return caixa;
    }

    /* A API devolve do mais recente para o mais antigo; a tira fica mais
       natural lida da esquerda (antigo) para a direita (recente). */
    sequencia
      .slice()
      .reverse()
      .forEach(function (r) {
        var classe = r === 'V' ? 'vitoria' : r === 'D' ? 'derrota' : 'empate';
        var titulo = r === 'V' ? 'Vitória' : r === 'D' ? 'Derrota' : 'Empate';
        caixa.appendChild(criar('span.forma-bola.' + classe, { title: titulo }, r));
      });

    return caixa;
  }

  /* ================================================================
     BARRA DE CONFIANCA
     ================================================================ */

  function barraConfianca(valor, nivel) {
    var caixa = criar('div.barra');
    var trilho = criar('div.barra-trilho');
    var preenchido = criar('div.barra-preenchida' + (nivel ? '.nivel-' + nivel : ''));
    preenchido.style.width = Math.max(2, Math.min(100, valor)) + '%';
    trilho.appendChild(preenchido);
    caixa.appendChild(trilho);
    caixa.appendChild(criar('span.barra-valor', valor.toFixed(1).replace('.', ',') + '%'));
    return caixa;
  }

  /** Barra de tres fatias: casa / empate / fora. */
  function barraTripla(prob, nomeCasa, nomeFora) {
    var caixa = criar('div.tripla');

    var barra = criar('div.tripla-barra');
    var fatias = [
      { classe: 'casa', v: prob.casa },
      { classe: 'empate', v: prob.empate },
      { classe: 'fora', v: prob.fora },
    ];
    fatias.forEach(function (f) {
      if (f.v <= 0) return;
      var d = criar('div.tripla-fatia.fatia-' + f.classe);
      d.style.width = (f.v * 100).toFixed(1) + '%';
      d.title = (f.v * 100).toFixed(1) + '%';
      barra.appendChild(d);
    });
    caixa.appendChild(barra);

    var legenda = criar('div.tripla-legenda');
    legenda.appendChild(itemLegenda('casa', nomeCasa, prob.casa));
    if (prob.empate > 0.005) legenda.appendChild(itemLegenda('empate', 'Empate', prob.empate));
    legenda.appendChild(itemLegenda('fora', nomeFora, prob.fora));
    caixa.appendChild(legenda);

    return caixa;
  }

  function itemLegenda(classe, nome, valor) {
    var i = criar('div.legenda-item');
    i.appendChild(criar('span.legenda-cor.cor-' + classe));
    i.appendChild(criar('span.legenda-nome', nome || ''));
    i.appendChild(criar('strong.legenda-valor', (valor * 100).toFixed(0) + '%'));
    return i;
  }

  /* ================================================================
     DIVERSOS
     ================================================================ */

  /* Posicoes vem em ingles da API. Traduz o que der; o que nao estiver
     no mapa passa direto, sem virar string vazia. */
  var POSICOES = {
    Goalkeeper: 'Goleiro',
    Defender: 'Defensor',
    Midfielder: 'Meio-campo',
    Forward: 'Atacante',
    Striker: 'Atacante',
    Winger: 'Ponta',
    Centre: 'Pivô',
    Center: 'Pivô',
    Guard: 'Armador',
    'Point Guard': 'Armador',
    'Shooting Guard': 'Ala-armador',
    'Small Forward': 'Ala',
    'Power Forward': 'Ala-pivô',
    Manager: 'Técnico',
    Coach: 'Técnico',
    Pitcher: 'Arremessador',
    Catcher: 'Receptor',
    Quarterback: 'Quarterback',
  };

  function traduzirPosicao(p) {
    return POSICOES[p] || p || '';
  }

  function parametro(nome) {
    try {
      return new URLSearchParams(location.search).get(nome);
    } catch (e) {
      return null;
    }
  }

  function secao(titulo, subtitulo) {
    var cab = criar('div.secao-cabecalho');
    cab.appendChild(criar('h2.secao-titulo', titulo));
    if (subtitulo) cab.appendChild(criar('p.secao-sub', subtitulo));
    return cab;
  }

  function linhaDado(rotulo, valor) {
    if (!valor) return null;
    var l = criar('div.dado');
    l.appendChild(criar('span.dado-rotulo', rotulo));
    l.appendChild(criar('span.dado-valor', String(valor)));
    return l;
  }

  var contadorToast = 0;
  function toast(mensagem, tipo) {
    var pilha = $('#pilha-toast');
    if (!pilha) {
      pilha = criar('div', { id: 'pilha-toast', class: 'pilha-toast' });
      document.body.appendChild(pilha);
    }
    var t = criar('div.toast' + (tipo ? '.toast-' + tipo : ''), mensagem);
    pilha.appendChild(t);

    var id = ++contadorToast;
    t.dataset.id = id;
    setTimeout(function () {
      t.classList.add('saindo');
      setTimeout(function () {
        t.remove();
      }, 300);
    }, 4200);
  }

  global.UI = {
    $: $,
    $$: $$,
    criar: criar,
    limpar: limpar,
    anexar: anexar,

    formatarHora: formatarHora,
    formatarData: formatarData,
    quandoAmigavel: quandoAmigavel,
    diaISO: diaISO,
    somarDias: somarDias,

    escudo: escudo,
    miniatura: miniatura,
    abreviar: abreviar,

    carregando: carregando,
    vazio: vazio,
    erro: erro,
    avisoDados: avisoDados,
    avisoPremium: avisoPremium,

    cardJogo: cardJogo,
    tiraDeForma: tiraDeForma,
    barraConfianca: barraConfianca,
    barraTripla: barraTripla,

    traduzirPosicao: traduzirPosicao,
    parametro: parametro,
    secao: secao,
    linhaDado: linhaDado,
    toast: toast,
  };
})(window);
