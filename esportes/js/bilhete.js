/* =====================================================================
   BILHETE DE APOSTA

   Desenha uma sugestao no formato de bilhete: simples (uma selecao) ou
   combinada (varias selecoes do mesmo jogo, estilo "Criar Aposta").

   SOBRE O NUMERO GRANDE NO CANTO:
   ele NAO e a odd da casa de apostas. A TheSportsDB nao fornece odds.
   E a ODD JUSTA do modelo — o inverso da probabilidade calculada.
   Serve para comparar: se a casa paga mais que isso, o preco esta a seu
   favor; se paga menos, a vantagem e da casa.
   ===================================================================== */

(function (global) {
  'use strict';

  var U = global.UI;
  var A = global.CONFIG.apostas;
  var criar = U.criar;

  /**
   * @param {Object} aposta  mercado simples ou combo vindos do Modelo
   * @param {Object} evento  a partida (para o rodape do bilhete)
   * @param {Object} opcoes  { destaque: bool, comLink: bool }
   */
  function montar(aposta, evento, opcoes) {
    opcoes = opcoes || {};
    var ehCombo = aposta.tipo === 'combo';
    var odd = ehCombo ? aposta.odd : aposta.oddJusta;

    var caixa = criar('article.bilhete');
    if (opcoes.destaque) caixa.classList.add('destaque');

    /* ---------------------------------------------------- topo --- */

    var topo = criar('header.bilhete-topo');
    topo.appendChild(
      criar('span.bilhete-tipo' + (ehCombo ? '' : '.simples'), ehCombo ? 'Criar Aposta' : 'Simples')
    );
    topo.appendChild(criar('span.etiqueta.' + aposta.nivel.classe, aposta.nivel.rotulo));
    topo.appendChild(criar('span.bilhete-odd', formatarOdd(odd)));
    caixa.appendChild(topo);

    /* -------------------------------------------------- pernas --- */

    var pernas = ehCombo ? aposta.pernas : [aposta];
    var listaPernas = criar('ul.bilhete-pernas');

    pernas.forEach(function (p) {
      var li = criar('li.perna');
      li.appendChild(criar('div.perna-titulo', p.selecao));
      li.appendChild(criar('div.perna-mercado', p.mercado));
      if (ehCombo && p.oddJusta) {
        li.appendChild(criar('div.perna-odd', 'sozinha: ' + formatarOdd(p.oddJusta)));
      }
      listaPernas.appendChild(li);
    });

    caixa.appendChild(listaPernas);

    /* ---------------------------------------------------- jogo --- */

    if (evento) {
      var bloco = criar('div.bilhete-jogo');

      var nome = (evento.casa.nome || '?') + ' x ' + (evento.fora.nome || '?');
      if (opcoes.comLink !== false && evento.id) {
        var link = criar(
          'a.bilhete-jogo-nome',
          { href: 'analise.html?evento=' + encodeURIComponent(evento.id) },
          nome
        );
        bloco.appendChild(link);
      } else {
        bloco.appendChild(criar('div.bilhete-jogo-nome', nome));
      }

      var linha = evento.liga ? evento.liga + ' · ' + U.quandoAmigavel(evento.quando) : U.quandoAmigavel(evento.quando);
      bloco.appendChild(criar('div.bilhete-jogo-hora', linha));
      caixa.appendChild(bloco);
    }

    /* -------------------------------------------------- rodape --- */

    var pe = criar('footer.bilhete-rodape');

    var linhaConf = criar('div.bilhete-linha');
    linhaConf.appendChild(criar('span.bilhete-rotulo', 'Índice de confiança'));
    pe.appendChild(linhaConf);
    pe.appendChild(U.barraConfianca(aposta.confianca, aposta.nivel.classe));

    /* A regra de valor, que e o ponto todo de mostrar a odd justa. */
    var dica = criar('div.valor-dica');
    dica.appendChild(criar('span', '💡'));
    var texto = criar('span');
    texto.appendChild(document.createTextNode('Só tem valor se a casa pagar '));
    texto.appendChild(criar('strong', formatarOdd(odd) + ' ou mais'));
    texto.appendChild(
      document.createTextNode('. Abaixo disso, o preço está a favor da casa, não seu.')
    );
    dica.appendChild(texto);
    pe.appendChild(dica);

    if (aposta.justificativa) {
      pe.appendChild(criar('p.bilhete-nota', aposta.justificativa));
    }

    caixa.appendChild(pe);
    return caixa;
  }

  /** Duas casas, com virgula — "1,46" e como a gente le em portugues. */
  function formatarOdd(o) {
    if (!o && o !== 0) return '—';
    return o.toFixed(2).replace('.', ',');
  }

  /**
   * Junta simples e combinadas de uma analise, ja filtradas pela odd
   * minima do config, ordenadas da maior para a menor confianca.
   */
  function sugestoesDe(analise, limite) {
    var itens = [];

    (analise.combos || []).forEach(function (c) {
      itens.push(c);
    });

    (analise.elegiveis || []).forEach(function (m) {
      itens.push(m);
    });

    itens.sort(function (a, b) {
      return b.confianca - a.confianca;
    });

    return limite ? itens.slice(0, limite) : itens;
  }

  /** Texto curto explicando por que a lista pode vir vazia. */
  function motivoListaVazia() {
    return (
      'Nenhuma sugestão passou nos dois filtros ao mesmo tempo: confiança mínima de ' +
      global.CONFIG.modelo.confiancaMinima +
      '% e odd justa a partir de ' +
      formatarOdd(A.oddMinima) +
      '. Isso normalmente significa que o jogo está equilibrado demais, ou que a API tinha ' +
      'poucos jogos anteriores para o modelo trabalhar.'
    );
  }

  global.Bilhete = {
    montar: montar,
    formatarOdd: formatarOdd,
    sugestoesDe: sugestoesDe,
    motivoListaVazia: motivoListaVazia,
  };
})(window);
