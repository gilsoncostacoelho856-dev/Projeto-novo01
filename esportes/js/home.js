/* =====================================================================
   PAGINA INICIAL
   Filtros (esporte / competicao / data), jogos ao vivo e jogos do dia.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;
  var U = global.UI;
  var criar = U.criar;

  var estado = {
    esporte: C.esportePadrao,
    idLiga: '',
    nomeLiga: '',
    data: U.diaISO(),
    ligas: [],
    jogos: [],
    mostrando: 0,
    relogio: null,
  };

  var el = {};

  /* ================================================================
     INICIO
     ================================================================ */

  function iniciar() {
    el.esporte = U.$('#f-esporte');
    el.liga = U.$('#f-liga');
    el.data = U.$('#f-data');
    el.atualizar = U.$('#f-atualizar');
    el.atalhos = U.$('#atalhos-liga');
    el.avisos = U.$('#avisos');
    el.secaoVivo = U.$('#secao-vivo');
    el.listaVivo = U.$('#lista-vivo');
    el.listaJogos = U.$('#lista-jogos');
    el.tituloJogos = U.$('#titulo-jogos');
    el.subJogos = U.$('#sub-jogos');
    el.areaMais = U.$('#area-mais');

    lerEndereco();
    montarFiltroEsportes();
    montarAtalhos();

    el.data.value = estado.data;

    el.esporte.addEventListener('change', function () {
      estado.esporte = el.esporte.value;
      estado.idLiga = '';
      estado.nomeLiga = '';
      montarAtalhos();
      carregarLigas();
      carregarTudo();
    });

    el.liga.addEventListener('change', function () {
      estado.idLiga = el.liga.value;
      estado.nomeLiga = el.liga.options[el.liga.selectedIndex].textContent;
      marcarAtalhoAtivo();
      carregarTudo();
    });

    el.data.addEventListener('change', function () {
      estado.data = el.data.value || U.diaISO();
      carregarTudo();
    });

    el.atualizar.addEventListener('click', function () {
      /* O botao existe para furar o cache de proposito. */
      global.Cache.limpar('dia:');
      global.Cache.limpar('aovivo:');
      global.Cache.limpar('proxliga:');
      carregarTudo();
    });

    carregarLigas();
    carregarTudo();
    ligarAutoAtualizacao();
  }

  /** Permite chegar na home ja filtrada: index.html?esporte=Soccer&data=... */
  function lerEndereco() {
    var esporte = U.parametro('esporte');
    var data = U.parametro('data');
    if (esporte) estado.esporte = esporte;
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) estado.data = data;
  }

  /* ================================================================
     FILTROS
     ================================================================ */

  function montarFiltroEsportes() {
    U.limpar(el.esporte);
    C.esportes.forEach(function (e) {
      var op = criar('option', { value: e.id }, e.icone + '  ' + e.nome);
      if (e.id === estado.esporte) op.selected = true;
      el.esporte.appendChild(op);
    });
  }

  function montarAtalhos() {
    U.limpar(el.atalhos);

    var doEsporte = C.ligasDestaque.filter(function (l) {
      return l.esporte === estado.esporte;
    });

    var todos = criar('button.chip', { type: 'button', 'data-liga': '' }, 'Todas');
    todos.addEventListener('click', function () {
      estado.idLiga = '';
      estado.nomeLiga = '';
      el.liga.value = '';
      marcarAtalhoAtivo();
      carregarTudo();
    });
    el.atalhos.appendChild(todos);

    doEsporte.forEach(function (l) {
      var chip = criar('button.chip', { type: 'button', 'data-liga-nome': l.nome }, l.apelido);
      chip.addEventListener('click', function () {
        selecionarLigaPorNome(l.nome);
      });
      el.atalhos.appendChild(chip);
    });

    marcarAtalhoAtivo();
  }

  function marcarAtalhoAtivo() {
    U.$$('.chip', el.atalhos).forEach(function (c) {
      var nome = c.getAttribute('data-liga-nome') || '';
      var ativo = estado.idLiga ? nome && nome === estado.nomeLigaOriginal : !nome;
      c.classList.toggle('ativo', !!ativo);
    });
  }

  /**
   * Procura a liga pelo nome na lista que veio da API.
   * Assim os atalhos nao dependem de id fixo no config.
   */
  function selecionarLigaPorNome(nome) {
    var achou = global.Api.acharLiga(estado.ligas, nome);

    if (!achou) {
      U.toast('Nao encontrei "' + nome + '" na lista da API para este esporte.', 'erro');
      return;
    }

    estado.idLiga = achou.id;
    estado.nomeLiga = achou.nome;
    estado.nomeLigaOriginal = nome;
    el.liga.value = achou.id;
    marcarAtalhoAtivo();
    carregarTudo();
  }

  function carregarLigas() {
    U.limpar(el.liga);
    el.liga.appendChild(criar('option', { value: '' }, 'Carregando competicoes...'));
    el.liga.disabled = true;

    global.Api.ligas(estado.esporte)
      .then(function (r) {
        estado.ligas = r.dados;
        U.limpar(el.liga);
        el.liga.appendChild(criar('option', { value: '' }, 'Todas as competições'));

        r.dados.forEach(function (l) {
          var texto = l.pais ? l.nome + ' (' + l.pais + ')' : l.nome;
          var op = criar('option', { value: l.id }, texto);
          if (l.id === estado.idLiga) op.selected = true;
          el.liga.appendChild(op);
        });

        el.liga.disabled = false;
      })
      .catch(function () {
        U.limpar(el.liga);
        el.liga.appendChild(criar('option', { value: '' }, 'Todas as competições'));
        el.liga.disabled = false;
        /* Sem a lista de ligas o site continua: o filtro por data
           sozinho ja traz jogos. */
      });
  }

  /* ================================================================
     CARGA
     ================================================================ */

  function carregarTudo() {
    sincronizarEndereco();
    U.limpar(el.avisos);
    carregarAoVivo();
    carregarJogos();
  }

  function sincronizarEndereco() {
    try {
      var q = new URLSearchParams();
      q.set('esporte', estado.esporte);
      if (estado.data !== U.diaISO()) q.set('data', estado.data);
      history.replaceState(null, '', location.pathname + '?' + q.toString());
    } catch (e) {}
  }

  /* ---------------------------------------------------- ao vivo ---- */

  function carregarAoVivo() {
    global.Api.jogosAoVivo(estado.esporte)
      .then(function (r) {
        var jogos = r.dados.filter(function (j) {
          return j.aoVivo;
        });

        if (!jogos.length) {
          el.secaoVivo.hidden = true;
          if (r.premium) mostrarAvisoAoVivo();
          return;
        }

        el.secaoVivo.hidden = false;
        U.limpar(el.listaVivo);
        jogos.forEach(function (j) {
          el.listaVivo.appendChild(U.cardJogo(j));
        });
      })
      .catch(function () {
        el.secaoVivo.hidden = true;
      });
  }

  var avisoAoVivoMostrado = false;
  function mostrarAvisoAoVivo() {
    if (avisoAoVivoMostrado) return;
    avisoAoVivoMostrado = true;

    el.avisos.appendChild(
      U.avisoPremium(
        'Placar ao vivo não veio: a chave de teste gratuita da TheSportsDB não libera esse endpoint. ' +
          'Assine o plano pago e troque a chave em js/config.js (e ligue usarV2AoVivo) para ativar.'
      )
    );
  }

  /* ------------------------------------------------------ jogos ---- */

  function carregarJogos() {
    U.limpar(el.listaJogos);
    U.limpar(el.areaMais);
    el.listaJogos.appendChild(U.carregando(6));

    var promessa = estado.idLiga ? carregarPorLiga() : global.Api.jogosDoDia(estado.data, estado.esporte);

    promessa
      .then(function (r) {
        if (r.aviso) el.avisos.appendChild(U.avisoDados(r.aviso));

        var jogos = r.dados.slice();

        /* Quando o filtro e por dia mas ha liga escolhida no select,
           corta aqui mesmo, sem gastar outra chamada. */
        if (estado.idLiga) {
          jogos = jogos.filter(function (j) {
            return !j.idLiga || j.idLiga === estado.idLiga;
          });
        }

        jogos.sort(function (a, b) {
          var ta = a.quando ? a.quando.getTime() : 0;
          var tb = b.quando ? b.quando.getTime() : 0;
          return ta - tb;
        });

        estado.jogos = jogos;
        estado.mostrando = 0;

        atualizarTitulo(jogos.length);
        U.limpar(el.listaJogos);

        if (!jogos.length) {
          el.listaJogos.appendChild(
            U.vazio(
              'Nenhum jogo encontrado',
              'Não há partidas de ' + nomeEsporte() + ' nessa data' +
                (estado.idLiga ? ' para a competição escolhida' : '') +
                '. Tente outro dia ou outro esporte.',
              botaoAmanha()
            )
          );
          return;
        }

        mostrarMais();
      })
      .catch(function (erro) {
        U.limpar(el.listaJogos);
        el.listaJogos.appendChild(
          U.erro(global.Api.mensagemAmigavel(erro), function () {
            carregarJogos();
          })
        );
      });
  }

  /** Com liga escolhida, junta os proximos e os ultimos jogos dela. */
  function carregarPorLiga() {
    return Promise.all([
      global.Api.proximosDaLiga(estado.idLiga).catch(function () {
        return { dados: [] };
      }),
      global.Api.ultimosDaLiga(estado.idLiga).catch(function () {
        return { dados: [] };
      }),
    ]).then(function (res) {
      var vistos = {};
      var juntos = [];

      res[0].dados.concat(res[1].dados).forEach(function (j) {
        if (vistos[j.id]) return;
        vistos[j.id] = true;
        juntos.push(j);
      });

      return { dados: juntos, origem: 'rede', aviso: res[0].aviso || res[1].aviso };
    });
  }

  function mostrarMais() {
    var passo = C.ui.jogosPorPagina;
    var fatia = estado.jogos.slice(estado.mostrando, estado.mostrando + passo);

    fatia.forEach(function (j) {
      el.listaJogos.appendChild(U.cardJogo(j));
    });
    estado.mostrando += fatia.length;

    U.limpar(el.areaMais);
    if (estado.mostrando < estado.jogos.length) {
      var restam = estado.jogos.length - estado.mostrando;
      var botao = criar(
        'button.btn.btn-contorno',
        { type: 'button' },
        'Ver mais ' + Math.min(restam, passo) + ' de ' + restam
      );
      botao.addEventListener('click', mostrarMais);
      el.areaMais.appendChild(botao);
    }
  }

  function atualizarTitulo(quantos) {
    var ehHoje = estado.data === U.diaISO();
    var base = estado.idLiga ? estado.nomeLiga : nomeEsporte();

    el.tituloJogos.textContent = estado.idLiga
      ? base
      : ehHoje
        ? 'Jogos de hoje — ' + base
        : 'Jogos de ' + base;

    var d = new Date(estado.data + 'T12:00:00Z');
    el.subJogos.textContent =
      quantos +
      (quantos === 1 ? ' partida' : ' partidas') +
      (estado.idLiga ? ' (próximas e últimas da competição)' : ' em ' + U.formatarData(d, true));
  }

  function nomeEsporte() {
    var achou = C.esportes.filter(function (e) {
      return e.id === estado.esporte;
    })[0];
    return achou ? achou.nome : estado.esporte;
  }

  function botaoAmanha() {
    var b = criar('button.btn.btn-contorno', { type: 'button' }, 'Ver o dia seguinte');
    b.addEventListener('click', function () {
      estado.data = U.somarDias(estado.data, 1);
      el.data.value = estado.data;
      carregarTudo();
    });
    return b;
  }

  /* ================================================================
     ATUALIZACAO AUTOMATICA
     So roda com a aba visivel — nao faz sentido gastar requisicao da
     chave gratuita para uma aba que ninguem esta olhando.
     ================================================================ */

  function ligarAutoAtualizacao() {
    if (!C.ui.autoAtualizarMs) return;

    estado.relogio = setInterval(function () {
      if (document.hidden) return;
      global.Cache.limpar('aovivo:');
      carregarAoVivo();
    }, C.ui.autoAtualizarMs);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) carregarAoVivo();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
