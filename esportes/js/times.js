/* =====================================================================
   PAGINA DE BUSCA DE TIMES
   Busca pelo nome ou lista todos os times de uma competicao.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;
  var U = global.UI;
  var Api = global.Api;
  var criar = U.criar;

  var estado = { esporte: C.esportePadrao, ligas: [] };
  var el = {};

  function iniciar() {
    el.busca = U.$('#f-busca');
    el.esporte = U.$('#f-esporte');
    el.liga = U.$('#f-liga');
    el.buscar = U.$('#f-buscar');
    el.avisos = U.$('#avisos');
    el.resultados = U.$('#resultados');

    C.esportes.forEach(function (e) {
      var op = criar('option', { value: e.id }, e.icone + '  ' + e.nome);
      if (e.id === estado.esporte) op.selected = true;
      el.esporte.appendChild(op);
    });

    el.esporte.addEventListener('change', function () {
      estado.esporte = el.esporte.value;
      carregarLigas();
    });

    el.liga.addEventListener('change', function () {
      if (el.liga.value) listarDaLiga(el.liga.value);
    });

    el.buscar.addEventListener('click', buscarPorNome);

    el.busca.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') buscarPorNome();
    });

    carregarLigas();

    /* Permite chegar aqui ja buscando: times.html?q=Flamengo */
    var q = U.parametro('q');
    if (q) {
      el.busca.value = q;
      buscarPorNome();
    } else {
      el.resultados.appendChild(
        U.vazio(
          'Comece a busca',
          'Digite o nome de um time ou escolha uma competição para ver todos os times dela.'
        )
      );
    }
  }

  function carregarLigas() {
    U.limpar(el.liga);
    el.liga.appendChild(criar('option', { value: '' }, 'Carregando...'));
    el.liga.disabled = true;

    Api.ligas(estado.esporte)
      .then(function (r) {
        estado.ligas = r.dados;
        U.limpar(el.liga);
        el.liga.appendChild(criar('option', { value: '' }, 'Escolha uma competição'));
        r.dados.forEach(function (l) {
          el.liga.appendChild(criar('option', { value: l.id }, l.pais ? l.nome + ' (' + l.pais + ')' : l.nome));
        });
        el.liga.disabled = false;
      })
      .catch(function () {
        U.limpar(el.liga);
        el.liga.appendChild(criar('option', { value: '' }, 'Competições indisponíveis'));
        el.liga.disabled = false;
      });
  }

  /* ================================================================
     BUSCAS
     ================================================================ */

  function buscarPorNome() {
    var termo = el.busca.value.trim();
    if (termo.length < 2) {
      U.toast('Digite ao menos 2 letras para buscar.', 'erro');
      return;
    }

    carregando();

    Api.buscarTimes(termo)
      .then(function (r) {
        desenhar(r.dados, 'Nenhum time chamado "' + termo + '"', r.aviso);
      })
      .catch(function (e) {
        U.limpar(el.resultados);
        el.resultados.appendChild(U.erro(Api.mensagemAmigavel(e), buscarPorNome));
      });
  }

  function listarDaLiga(idLiga) {
    carregando();

    Api.timesDaLiga(idLiga)
      .then(function (r) {
        desenhar(r.dados, 'Esta competição não retornou times', r.aviso);
      })
      .catch(function (e) {
        U.limpar(el.resultados);
        el.resultados.appendChild(U.erro(Api.mensagemAmigavel(e)));
      });
  }

  function carregando() {
    U.limpar(el.avisos);
    U.limpar(el.resultados);
    for (var i = 0; i < 6; i++) el.resultados.appendChild(criar('div.esqueleto.esqueleto-linha'));
  }

  /* ================================================================
     DESENHO
     ================================================================ */

  function desenhar(times, mensagemVazia, aviso) {
    U.limpar(el.resultados);
    if (aviso) el.avisos.appendChild(U.avisoDados(aviso));

    if (!times.length) {
      el.resultados.appendChild(
        U.vazio(mensagemVazia, 'Tente escrever o nome como ele aparece na TheSportsDB, em inglês quando for o caso.')
      );
      return;
    }

    times
      .slice()
      .sort(function (a, b) {
        return (a.nome || '').localeCompare(b.nome || '');
      })
      .forEach(function (t) {
        el.resultados.appendChild(cardTime(t));
      });
  }

  function cardTime(t) {
    var card = criar('a.card-jogo', { href: 'time.html?id=' + encodeURIComponent(t.id) });
    card.style.color = 'inherit';

    var topo = criar('header.card-topo');
    topo.appendChild(criar('span.card-liga', t.liga || t.esporte || ''));
    if (t.pais) topo.appendChild(criar('span.selo', t.pais));
    card.appendChild(topo);

    var corpo = criar('div');
    corpo.style.cssText = 'display:flex;align-items:center;gap:12px;padding:16px 13px';
    corpo.appendChild(U.escudo(t.escudo || t.logo, t.nome, 48));

    var texto = criar('div');
    texto.style.minWidth = '0';
    texto.appendChild(criar('div.card-time-nome', t.nome));
    var sub = [t.estadio, t.fundacao ? 'desde ' + t.fundacao : null].filter(Boolean).join(' · ');
    if (sub) texto.appendChild(criar('div.card-local', sub));
    corpo.appendChild(texto);

    card.appendChild(corpo);
    return card;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
