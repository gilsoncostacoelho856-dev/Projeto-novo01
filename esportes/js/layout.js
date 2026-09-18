/* =====================================================================
   LAYOUT COMPARTILHADO
   Cabecalho, rodape e o portao de idade 18+.

   Esta tudo aqui porque aparece em todas as paginas — assim so existe
   um lugar para corrigir quando precisar mudar alguma coisa.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;
  var U = global.UI;
  var criar = U.criar;

  /* ================================================================
     PORTAO DE IDADE  (18+)

     Como o bloqueio funciona de verdade:
     1. Um script no <head> de cada pagina marca <html class="bloqueado">
        ANTES de qualquer conteudo pintar na tela.
     2. O CSS esconde todo o conteudo enquanto essa classe existir.
     3. Este arquivo desenha o modal por cima.
     4. So a confirmacao tira a classe.

     Ou seja: nao existe um instante em que o site apareca sem a barreira,
     nem "fechar o modal no inspetor" resolve — o conteudo continua
     escondido pelo CSS.
     ================================================================ */

  var R = C.responsavel;

  function idadeConfirmada() {
    try {
      var bruto = localStorage.getItem(R.chaveArmazenamento);
      if (!bruto) return false;

      var reg = JSON.parse(bruto);
      if (!reg || !reg.em) return false;

      var validade = (R.validadeDias || 30) * 86400000;
      return Date.now() - reg.em < validade;
    } catch (e) {
      /* Sem localStorage (aba anonima) pergunta toda vez. Tudo bem. */
      return false;
    }
  }

  function gravarConfirmacao() {
    try {
      localStorage.setItem(R.chaveArmazenamento, JSON.stringify({ em: Date.now() }));
    } catch (e) {}
  }

  function montarPortao() {
    if (idadeConfirmada()) {
      document.documentElement.classList.remove('bloqueado');
      return;
    }

    document.documentElement.classList.add('bloqueado');

    var fundo = criar('div.portao', { id: 'portao-idade', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': 'portao-titulo' });

    var caixa = criar('div.portao-caixa');

    caixa.appendChild(criar('div.portao-selo', '18+'));
    caixa.appendChild(criar('h1.portao-titulo', { id: 'portao-titulo' }, 'Conteúdo para maiores de 18 anos'));

    caixa.appendChild(
      criar(
        'p.portao-texto',
        C.ui.nomeSite + ' reúne dados e resultados esportivos. O conteúdo é informativo e destinado a ' +
          'maiores de idade. Apostar é proibido para menores de 18 anos no Brasil.'
      )
    );

    var lista = criar('ul.portao-lista');
    [
      'O site mostra resultados passados. Não há previsão nem indicação de aposta.',
      'Aposte apenas o que você pode perder por completo.',
      'Aposta não é fonte de renda nem solução para dívida.',
    ].forEach(function (t) {
      lista.appendChild(criar('li', t));
    });
    caixa.appendChild(lista);

    var botoes = criar('div.portao-botoes');

    var sim = criar('button.btn.btn-principal', { type: 'button' }, 'Tenho 18 anos ou mais');
    sim.addEventListener('click', function () {
      gravarConfirmacao();
      document.documentElement.classList.remove('bloqueado');
      fundo.classList.add('saindo');
      setTimeout(function () {
        fundo.remove();
      }, 240);
      document.dispatchEvent(new CustomEvent('idade:confirmada'));
    });

    var nao = criar('button.btn.btn-contorno', { type: 'button' }, 'Sou menor de 18 anos');
    nao.addEventListener('click', function () {
      mostrarRecusa(caixa);
    });

    botoes.appendChild(sim);
    botoes.appendChild(nao);
    caixa.appendChild(botoes);

    var ajuda = criar('p.portao-ajuda');
    ajuda.appendChild(document.createTextNode('Precisa de ajuda com o jogo? '));
    ajuda.appendChild(
      criar('a', { href: R.ajuda[0].url, target: '_blank', rel: 'noopener noreferrer' }, R.ajuda[0].nome)
    );
    caixa.appendChild(ajuda);

    fundo.appendChild(caixa);
    document.body.appendChild(fundo);

    /* Foco no modal e prende o Tab dentro dele. */
    setTimeout(function () {
      sim.focus();
    }, 50);
    fundo.addEventListener('keydown', prenderFoco);
  }

  function mostrarRecusa(caixa) {
    U.limpar(caixa);

    caixa.appendChild(criar('div.portao-selo.portao-selo-bloqueado', '⛔'));
    caixa.appendChild(criar('h1.portao-titulo', 'Acesso não permitido'));
    caixa.appendChild(
      criar(
        'p.portao-texto',
        'Este site é restrito a maiores de 18 anos e não pode ser exibido para você. ' +
          'Apostas por menores de idade são proibidas por lei no Brasil.'
      )
    );

    var links = criar('div.portao-botoes');
    links.appendChild(
      criar(
        'a.btn.btn-contorno',
        { href: 'https://www.gov.br/pt-br', target: '_blank', rel: 'noopener noreferrer' },
        'Sair do site'
      )
    );
    caixa.appendChild(links);

    var ajuda = criar('p.portao-ajuda');
    ajuda.appendChild(document.createTextNode('Se o jogo já é um problema para você ou para alguém próximo: '));
    R.ajuda.forEach(function (a, i) {
      if (i) ajuda.appendChild(document.createTextNode(' · '));
      ajuda.appendChild(criar('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.nome));
    });
    caixa.appendChild(ajuda);
  }

  function prenderFoco(ev) {
    if (ev.key !== 'Tab') return;
    var focaveis = this.querySelectorAll('button, a[href]');
    if (!focaveis.length) return;

    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];

    if (ev.shiftKey && document.activeElement === primeiro) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primeiro.focus();
    }
  }

  /* ================================================================
     CABECALHO
     ================================================================ */

  var MENU = [
    { href: 'index.html', rotulo: 'Jogos', pagina: 'home' },
    { href: 'times.html', rotulo: 'Times', pagina: 'times' },
  ];

  function montarCabecalho() {
    var alvo = document.getElementById('cabecalho');
    if (!alvo) return;

    var atual = document.body.dataset.pagina || '';

    var cab = criar('header.cabecalho');
    var faixa = criar('div.cabecalho-interno');

    var marca = criar('a.marca', { href: 'index.html', 'aria-label': C.ui.nomeSite + ' — início' });
    marca.appendChild(criar('span.marca-icone', '◉'));
    var textoMarca = criar('span.marca-texto');
    textoMarca.appendChild(criar('strong', C.ui.nomeSite));
    textoMarca.appendChild(criar('small', 'estatística esportiva'));
    marca.appendChild(textoMarca);
    faixa.appendChild(marca);

    var nav = criar('nav.menu', { 'aria-label': 'Navegação principal' });
    MENU.forEach(function (m) {
      var a = criar('a.menu-item', { href: m.href }, m.rotulo);
      if (m.pagina === atual) {
        a.classList.add('ativo');
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });
    faixa.appendChild(nav);

    var selo18 = criar('span.selo-18', { title: 'Conteúdo restrito a maiores de 18 anos' }, '18+');
    faixa.appendChild(selo18);

    cab.appendChild(faixa);
    alvo.replaceWith(cab);
  }

  /* ================================================================
     RODAPE  +  AVISO FIXO DE JOGO RESPONSAVEL
     ================================================================ */

  function montarRodape() {
    var alvo = document.getElementById('rodape');
    if (!alvo) return;

    var pe = criar('footer.rodape');
    var interno = criar('div.rodape-interno');

    /* --- coluna 1: o que e o site --- */
    var col1 = criar('div.rodape-col');
    col1.appendChild(criar('h3.rodape-titulo', C.ui.nomeSite));
    col1.appendChild(
      criar(
        'p.rodape-texto',
        'Dados públicos da TheSportsDB, exibidos como vieram. Não calculamos probabilidade ' +
          'nem odd, não vendemos palpite, não aceitamos aposta e não intermediamos pagamento.'
      )
    );
    interno.appendChild(col1);

    /* --- coluna 2: o aviso que importa --- */
    var col2 = criar('div.rodape-col');
    col2.appendChild(criar('h3.rodape-titulo', 'Jogo responsável'));

    var pontos = criar('ul.rodape-lista');
    [
      'Proibido para menores de 18 anos.',
      'Resultado passado não prevê jogo futuro. Zebra existe.',
      'Nunca aposte dinheiro de conta, dívida ou empréstimo.',
      'Perdeu? Não tente recuperar apostando mais.',
    ].forEach(function (t) {
      pontos.appendChild(criar('li', t));
    });
    col2.appendChild(pontos);
    interno.appendChild(col2);

    /* --- coluna 3: onde buscar ajuda --- */
    var col3 = criar('div.rodape-col');
    col3.appendChild(criar('h3.rodape-titulo', 'Precisa de ajuda?'));
    col3.appendChild(criar('p.rodape-texto', 'O atendimento é gratuito, sigiloso e funciona em todo o Brasil.'));

    var links = criar('ul.rodape-lista.rodape-links');
    R.ajuda.forEach(function (a) {
      var li = criar('li');
      li.appendChild(criar('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.nome));
      links.appendChild(li);
    });
    col3.appendChild(links);
    interno.appendChild(col3);

    pe.appendChild(interno);

    var base = criar('div.rodape-base');
    base.appendChild(
      criar('small', '© ' + new Date().getFullYear() + ' ' + C.ui.nomeSite + ' · uso informativo e educacional')
    );
    base.appendChild(criar('small', 'Dados: TheSportsDB'));
    pe.appendChild(base);

    alvo.replaceWith(pe);
  }

  /**
   * A barra fixa que nunca sai da tela.
   * Obrigatoria pelo enunciado e, sinceramente, a parte mais importante
   * do site inteiro.
   */
  function montarBarraFixa() {
    if (document.querySelector('.barra-responsavel')) return;

    var barra = criar('div.barra-responsavel', { role: 'complementary',
      'aria-label': 'Aviso de jogo responsável' });

    var interno = criar('div.barra-responsavel-interno');

    interno.appendChild(criar('strong.barra-18', '18+'));
    interno.appendChild(
      criar(
        'span.barra-texto',
        'Conteúdo informativo: o site não indica apostas. Aposta pode causar dependência.'
      )
    );

    var link = criar(
      'a.barra-link',
      { href: R.ajuda[0].url, target: '_blank', rel: 'noopener noreferrer' },
      'Buscar ajuda'
    );
    interno.appendChild(link);

    barra.appendChild(interno);
    document.body.appendChild(barra);
  }

  /* ================================================================
     INICIO
     ================================================================ */

  function iniciar() {
    montarPortao();
    montarCabecalho();
    montarRodape();
    montarBarraFixa();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  global.Layout = { idadeConfirmada: idadeConfirmada };
})(window);
