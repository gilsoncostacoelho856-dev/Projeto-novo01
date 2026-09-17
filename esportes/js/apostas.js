/* =====================================================================
   PAGINA "APOSTAS DO DIA"

   Pega os jogos do dia, roda o modelo em cada um e ordena todas as
   sugestoes pelo indice de confianca.

   O gargalo aqui e a API: cada partida custa ate 3 chamadas (ultimos
   jogos do mandante, do visitante e o confronto direto). Por isso:
     - o numero de jogos analisados e limitado pelo config;
     - a analise roda em serie, com barra de progresso;
     - tudo passa pelo cache, entao reabrir a pagina no mesmo dia e
       praticamente instantaneo.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;
  var U = global.UI;
  var Api = global.Api;
  var criar = U.criar;

  var estado = {
    esporte: C.esportePadrao,
    data: U.diaISO(),
    oddMinima: C.apostas.oddMinima,
    tipo: 'todas',
    sugestoes: [],
    rodando: false,
    cancelar: false,
  };

  var el = {};

  /* ================================================================
     INICIO
     ================================================================ */

  function iniciar() {
    el.esporte = U.$('#f-esporte');
    el.data = U.$('#f-data');
    el.odd = U.$('#f-odd');
    el.analisar = U.$('#f-analisar');
    el.atalhos = U.$('#atalhos-tipo');
    el.avisos = U.$('#avisos');
    el.progresso = U.$('#progresso');
    el.secaoDestaque = U.$('#secao-destaque');
    el.destaque = U.$('#destaque');
    el.subDestaque = U.$('#sub-destaque');
    el.lista = U.$('#lista');
    el.tituloLista = U.$('#titulo-lista');
    el.subLista = U.$('#sub-lista');

    C.esportes.forEach(function (e) {
      var op = criar('option', { value: e.id }, e.icone + '  ' + e.nome);
      if (e.id === estado.esporte) op.selected = true;
      el.esporte.appendChild(op);
    });

    el.data.value = estado.data;
    el.odd.value = String(C.apostas.oddMinima.toFixed(2));

    el.analisar.addEventListener('click', function () {
      if (estado.rodando) {
        estado.cancelar = true;
        return;
      }
      estado.esporte = el.esporte.value;
      estado.data = el.data.value || U.diaISO();
      estado.oddMinima = parseFloat(el.odd.value);
      analisarDia();
    });

    el.odd.addEventListener('change', function () {
      estado.oddMinima = parseFloat(el.odd.value);
      if (estado.sugestoes.length) desenhar();
    });

    U.$$('.chip', el.atalhos).forEach(function (chip) {
      chip.addEventListener('click', function () {
        U.$$('.chip', el.atalhos).forEach(function (c) {
          c.classList.remove('ativo');
        });
        chip.classList.add('ativo');
        estado.tipo = chip.getAttribute('data-tipo');
        if (estado.sugestoes.length) desenhar();
      });
    });

    analisarDia();
  }

  /* ================================================================
     ANALISE EM LOTE
     ================================================================ */

  function analisarDia() {
    estado.rodando = true;
    estado.cancelar = false;
    estado.sugestoes = [];

    U.limpar(el.avisos);
    U.limpar(el.lista);
    U.limpar(el.destaque);
    el.secaoDestaque.hidden = true;
    el.analisar.textContent = 'Parar';

    mostrarProgresso(0, 0, 'Buscando os jogos do dia...');

    Api.jogosDoDia(estado.data, estado.esporte)
      .then(function (r) {
        if (r.aviso) el.avisos.appendChild(U.avisoDados(r.aviso));

        /* So faz sentido analisar jogo que ainda nao aconteceu. */
        var candidatos = r.dados.filter(function (j) {
          return !j.temPlacar && !j.adiado && j.casa.id && j.fora.id;
        });

        if (!candidatos.length) {
          terminar();
          U.limpar(el.lista);
          el.lista.appendChild(
            U.vazio(
              'Nenhum jogo para analisar',
              'Não encontrei partidas futuras de ' + nomeEsporte() + ' nessa data com dados ' +
                'suficientes na API. Tente outra data ou outro esporte.'
            )
          );
          return;
        }

        var alvos = candidatos.slice(0, C.modelo.maxJogosAnalisados);

        if (candidatos.length > alvos.length) {
          el.avisos.appendChild(
            U.avisoDados(
              'Encontrei ' + candidatos.length + ' jogos, mas analisei os ' + alvos.length +
                ' primeiros para não estourar o limite da chave gratuita. ' +
                'Ajuste maxJogosAnalisados em js/config.js se você já tem plano pago.'
            )
          );
        }

        return analisarSequencia(alvos);
      })
      .catch(function (erro) {
        terminar();
        U.limpar(el.lista);
        el.lista.appendChild(U.erro(Api.mensagemAmigavel(erro), analisarDia));
      });
  }

  /**
   * Um jogo por vez, de proposito. Disparar tudo em paralelo estouraria
   * o limite da chave gratuita mesmo com a fila do api.js.
   */
  function analisarSequencia(jogos) {
    var indice = 0;

    function proximo() {
      if (estado.cancelar || indice >= jogos.length) {
        terminar();
        desenhar();
        return Promise.resolve();
      }

      var jogo = jogos[indice];
      mostrarProgresso(indice, jogos.length, jogo.casa.nome + ' x ' + jogo.fora.nome);

      return analisarJogo(jogo)
        .catch(function () {
          /* Um jogo sem dados nao pode derrubar a pagina inteira. */
          return null;
        })
        .then(function () {
          indice++;
          /* Desenha conforme vai saindo, para a tela nao ficar parada. */
          if (indice % 3 === 0) desenhar();
          return proximo();
        });
    }

    return proximo();
  }

  function analisarJogo(ev) {
    return Promise.all([
      Api.ultimosDoTime(ev.casa.id).catch(vazio),
      Api.ultimosDoTime(ev.fora.id).catch(vazio),
      Api.confrontos(ev.casa.nome, ev.fora.nome, ev.casa.id, ev.fora.id).catch(vazio),
    ]).then(function (res) {
      var analise = global.Modelo.analisar({
        casa: ev.casa,
        fora: ev.fora,
        ultimosCasa: res[0].dados,
        ultimosFora: res[1].dados,
        confrontos: res[2].dados,
        esporte: ev.esporte,
      });

      /* Sem nenhum jogo anterior o modelo nao tem o que dizer. */
      if (!analise.formaCasa.quantidade && !analise.formaFora.quantidade) return;

      global.Bilhete.sugestoesDe(analise).forEach(function (s) {
        estado.sugestoes.push({ aposta: s, evento: ev, analise: analise });
      });
    });
  }

  function vazio() {
    return { dados: [] };
  }

  /* ================================================================
     DESENHO
     ================================================================ */

  function desenhar() {
    var filtradas = estado.sugestoes.filter(function (s) {
      var odd = s.aposta.tipo === 'combo' ? s.aposta.odd : s.aposta.oddJusta;
      if (!odd || odd < estado.oddMinima) return false;
      if (estado.tipo === 'combo' && s.aposta.tipo !== 'combo') return false;
      if (estado.tipo === 'simples' && s.aposta.tipo !== 'simples') return false;
      return true;
    });

    filtradas.sort(function (a, b) {
      return b.aposta.confianca - a.aposta.confianca;
    });

    /* No maximo uma sugestao por partida na lista principal: dez
       variacoes do mesmo jogo nao sao dez apostas. */
    var porJogo = {};
    var enxuta = filtradas.filter(function (s) {
      if (porJogo[s.evento.id]) return false;
      porJogo[s.evento.id] = true;
      return true;
    });

    U.limpar(el.destaque);
    U.limpar(el.lista);

    if (!enxuta.length) {
      el.secaoDestaque.hidden = true;
      el.tituloLista.textContent = 'Nenhuma seleção passou nos filtros';
      el.subLista.textContent = '';
      el.lista.appendChild(
        U.vazio(
          'Nada dentro dos seus critérios',
          estado.rodando
            ? 'Ainda estou analisando os jogos...'
            : 'Tente baixar a odd mínima, trocar a data ou escolher outro esporte. ' +
                global.Bilhete.motivoListaVazia()
        )
      );
      return;
    }

    /* --- a melhor do dia --- */
    var melhor = enxuta[0];
    el.secaoDestaque.hidden = false;
    el.subDestaque.textContent =
      'Maior índice de confiança entre ' + enxuta.length + ' partida(s) analisada(s), ' +
      'respeitando a odd mínima de ' + global.Bilhete.formatarOdd(estado.oddMinima) + '.';
    el.destaque.appendChild(global.Bilhete.montar(melhor.aposta, melhor.evento, { destaque: true }));

    /* --- as demais --- */
    var resto = enxuta.slice(1);
    el.tituloLista.textContent = 'Demais seleções';
    el.subLista.textContent = resto.length
      ? resto.length + ' outra(s) partida(s) dentro dos filtros.'
      : 'Nenhuma outra partida passou nos filtros.';

    resto.forEach(function (s) {
      el.lista.appendChild(global.Bilhete.montar(s.aposta, s.evento));
    });
  }

  /* ================================================================
     PROGRESSO
     ================================================================ */

  function mostrarProgresso(feitos, total, rotulo) {
    U.limpar(el.progresso);

    var caixa = criar('div.progresso');
    var texto = criar('div.progresso-texto');
    texto.appendChild(criar('span', rotulo || ''));
    texto.appendChild(criar('span', total ? feitos + ' / ' + total : ''));
    caixa.appendChild(texto);

    var trilho = criar('div.progresso-trilho');
    var cheio = criar('div.progresso-preenchido');
    cheio.style.width = (total ? (feitos / total) * 100 : 8) + '%';
    trilho.appendChild(cheio);
    caixa.appendChild(trilho);

    el.progresso.appendChild(caixa);
  }

  function terminar() {
    estado.rodando = false;
    estado.cancelar = false;
    el.analisar.textContent = 'Analisar';
    U.limpar(el.progresso);
  }

  function nomeEsporte() {
    var achou = C.esportes.filter(function (e) {
      return e.id === estado.esporte;
    })[0];
    return achou ? achou.nome : estado.esporte;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
