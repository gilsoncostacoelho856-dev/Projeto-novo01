/* =====================================================================
   PAGINA DE COMPARACAO DE UMA PARTIDA

   Mostra, lado a lado, o retrospecto recente das duas equipes e o
   historico de confrontos entre elas. Todo numero desta pagina vem de
   contar os placares que a API devolveu, e a lista de jogos fica logo
   abaixo de cada contagem justamente para voce conferir.

   Esta pagina NAO indica em que apostar, nao calcula probabilidade e
   nao exibe odd. O motivo esta no cabecalho de js/estatisticas.js.
   ===================================================================== */

(function (global) {
  'use strict';

  var U = global.UI;
  var Api = global.Api;
  var Est = global.Estatisticas;
  var criar = U.criar;

  var conteudo;

  function iniciar() {
    conteudo = U.$('#conteudo');

    var idEvento = U.parametro('evento');
    if (!idEvento) {
      mostrarErro('Nenhuma partida escolhida.', 'Volte para a lista de jogos e clique em "Comparar equipes".');
      return;
    }

    carregar(idEvento);
  }

  /* ================================================================
     CARGA
     ================================================================ */

  function carregar(idEvento) {
    U.limpar(conteudo);
    conteudo.appendChild(esqueletoInicial());

    Api.evento(idEvento)
      .then(function (r) {
        if (!r.dados) throw new Api.ErroApi('Partida não encontrada na base de dados.', 'formato');
        return carregarContexto(r.dados);
      })
      .catch(function (erro) {
        mostrarErro(Api.mensagemAmigavel(erro), null, function () {
          carregar(idEvento);
        });
      });
  }

  function carregarContexto(ev) {
    var temIds = ev.casa.id && ev.fora.id;

    return Promise.all([
      temIds ? Api.ultimosDoTime(ev.casa.id).catch(vazio) : Promise.resolve({ dados: [] }),
      temIds ? Api.ultimosDoTime(ev.fora.id).catch(vazio) : Promise.resolve({ dados: [] }),
      Api.confrontos(ev.casa.nome, ev.fora.nome, ev.casa.id, ev.fora.id).catch(vazio),
    ]).then(function (res) {
      /* A propria partida nao entra no retrospecto dela mesma. */
      var semEla = function (lista) {
        return lista.filter(function (j) {
          return j.id !== ev.id;
        });
      };

      var comparacao = Est.comparar({
        casa: ev.casa,
        fora: ev.fora,
        ultimosCasa: semEla(res[0].dados),
        ultimosFora: semEla(res[1].dados),
        confrontos: semEla(res[2].dados),
        esporte: ev.esporte,
      });

      desenhar(ev, comparacao, res[2].metodo);
    });
  }

  function vazio() {
    return { dados: [] };
  }

  /* ================================================================
     DESENHO
     ================================================================ */

  function desenhar(ev, comp, metodoH2h) {
    U.limpar(conteudo);

    conteudo.appendChild(cabecalhoConfronto(ev));
    conteudo.appendChild(notaDeEscopo());
    conteudo.appendChild(secaoRetrospecto(ev, comp));
    conteudo.appendChild(secaoGols(ev, comp));
    conteudo.appendChild(secaoConfrontos(ev, comp, metodoH2h));
    conteudo.appendChild(secaoFicha(ev));
  }

  /* ----------------------------------------------- cabecalho ------ */

  function cabecalhoConfronto(ev) {
    var caixa = criar('div.confronto-cabecalho');
    caixa.appendChild(ladoConfronto(ev.casa));

    var meio = criar('div.confronto-meio');
    if (ev.temPlacar) {
      meio.appendChild(criar('div.card-placar', ev.placarCasa + ' – ' + ev.placarFora));
    } else {
      meio.appendChild(criar('div.confronto-vs', 'VS'));
    }
    meio.appendChild(criar('div.confronto-hora', U.quandoAmigavel(ev.quando)));
    if (ev.liga) meio.appendChild(criar('div.card-liga', ev.liga));
    caixa.appendChild(meio);

    caixa.appendChild(ladoConfronto(ev.fora));
    return caixa;
  }

  function ladoConfronto(time) {
    var alvo = time.id ? 'time.html?id=' + encodeURIComponent(time.id) : null;
    var caixa = alvo ? criar('a.confronto-time', { href: alvo }) : criar('div.confronto-time');
    caixa.appendChild(U.escudo(time.escudo, time.nome, 58));
    caixa.appendChild(criar('span.confronto-time-nome', time.nome || '—'));
    return caixa;
  }

  /* ----------------------------------------------- nota ----------- */

  /**
   * Fica no topo, antes dos numeros, e nao no rodape.
   * Aviso que so aparece depois que a pessoa ja leu tudo nao serve
   * para nada.
   */
  function notaDeEscopo() {
    var aviso = criar('div.aviso-modelo');
    aviso.appendChild(criar('h3', 'O que esta página mostra'));
    aviso.appendChild(
      criar(
        'p',
        'Apenas contagens dos jogos que a TheSportsDB registrou: quantas vitórias, empates e ' +
          'derrotas, quantos gols, e os placares dos confrontos anteriores. A lista de jogos fica ' +
          'logo abaixo de cada número para você conferir a conta.'
      )
    );
    aviso.appendChild(
      criar(
        'p',
        'Não há previsão, probabilidade, odd nem indicação de aposta. ' +
          'Retrospecto passado não determina resultado futuro — uma equipe com cinco vitórias ' +
          'seguidas pode perder a próxima, e isso acontece o tempo todo.'
      )
    );
    return aviso;
  }

  /* ----------------------------------------------- retrospecto ---- */

  function secaoRetrospecto(ev, comp) {
    var s = criar('section.secao');
    s.appendChild(
      U.secao('Retrospecto recente', 'Os últimos jogos de cada equipe registrados na API.')
    );

    var colunas = criar('div.duas-colunas');
    colunas.appendChild(painelRetrospecto(ev.casa, comp.retrospectoCasa));
    colunas.appendChild(painelRetrospecto(ev.fora, comp.retrospectoFora));
    s.appendChild(colunas);

    return s;
  }

  function painelRetrospecto(time, r) {
    var p = criar('div.painel');

    var topo = criar('div.painel-topo');
    topo.appendChild(U.escudo(time.escudo, time.nome, 36));
    topo.appendChild(criar('strong', time.nome || '—'));
    p.appendChild(topo);

    if (!r.quantidade) {
      p.appendChild(criar('p.estado-texto', r.resumo));
      return p;
    }

    /* A frase em texto vem antes das bolinhas: é ela que a pessoa lê. */
    p.appendChild(criar('p.resumo-frase', r.resumo));
    p.appendChild(U.tiraDeForma(r.sequencia));

    var m = criar('div.metricas');
    m.style.marginTop = '14px';
    m.appendChild(metrica(r.vitorias + '-' + r.empates + '-' + r.derrotas, 'V-E-D'));
    m.appendChild(metrica(String(r.golsPro), 'Gols feitos'));
    m.appendChild(metrica(String(r.golsContra), 'Gols sofridos'));
    m.appendChild(metrica(String(r.golsPro - r.golsContra), 'Saldo'));
    p.appendChild(m);

    /* A lista que permite conferir a contagem acima. */
    var lista = criar('div.lista-jogos');
    r.jogos.forEach(function (j) {
      var linha = criar('div.dado');

      var esq = criar('span.dado-rotulo', j.adversario + (j.emCasa ? ' (casa)' : ' (fora)'));
      linha.appendChild(esq);

      var dir = criar('span.dado-valor', j.golsPro + '–' + j.golsContra);
      dir.className += j.resultado === 'V' ? ' destaque-v' : j.resultado === 'D' ? ' destaque-d' : '';
      linha.appendChild(dir);

      lista.appendChild(linha);
    });
    p.appendChild(lista);

    return p;
  }

  /* ----------------------------------------------- gols ----------- */

  function secaoGols(ev, comp) {
    if (!comp.golsCasa && !comp.golsFora) return criar('span');

    var s = criar('section.secao');
    s.appendChild(
      U.secao('Média de gols por mando', 'Média simples dos jogos listados acima, separando casa de fora.')
    );

    var painel = criar('div.painel');
    var caixa = criar('div.tabela-caixa');
    var t = criar('table.tabela');

    var thead = criar('thead');
    var tr = criar('tr');
    ['', ev.casa.nome, ev.fora.nome].forEach(function (h) {
      tr.appendChild(criar('th', h));
    });
    thead.appendChild(tr);
    t.appendChild(thead);

    var tbody = criar('tbody');
    [
      ['Marcados em casa', 'casaPro'],
      ['Sofridos em casa', 'casaContra'],
      ['Marcados fora', 'foraPro'],
      ['Sofridos fora', 'foraContra'],
    ].forEach(function (par) {
      var linha = criar('tr');
      linha.appendChild(criar('td', par[0]));
      linha.appendChild(criar('td.num', valorGol(comp.golsCasa, par[1])));
      linha.appendChild(criar('td.num', valorGol(comp.golsFora, par[1])));
      tbody.appendChild(linha);
    });
    t.appendChild(tbody);

    caixa.appendChild(t);
    painel.appendChild(caixa);

    painel.appendChild(
      criar(
        'p.bilhete-nota',
        'Onde aparece um traço, a equipe não tem nenhum jogo daquele tipo entre os ' +
          'listados acima — e sem jogo não existe média.'
      )
    );

    s.appendChild(painel);
    return s;
  }

  function valorGol(gols, campo) {
    if (!gols || gols[campo] === null || gols[campo] === undefined) return '—';
    return gols[campo].toFixed(1).replace('.', ',');
  }

  /* ----------------------------------------------- confrontos ----- */

  function secaoConfrontos(ev, comp, metodo) {
    var s = criar('section.secao');
    var h2h = comp.confrontos;

    s.appendChild(U.secao('Confrontos diretos'));

    if (!h2h.quantidade) {
      s.appendChild(U.vazio('Sem histórico disponível', h2h.resumo));
      return s;
    }

    var painel = criar('div.painel');
    painel.appendChild(criar('p.resumo-frase', h2h.resumo));

    var m = criar('div.metricas');
    m.style.marginTop = '12px';
    m.appendChild(metrica(String(h2h.vitoriasCasa), 'Vit. ' + U.abreviar(ev.casa.nome)));
    m.appendChild(metrica(String(h2h.empates), 'Empates'));
    m.appendChild(metrica(String(h2h.vitoriasFora), 'Vit. ' + U.abreviar(ev.fora.nome)));
    m.appendChild(metrica(h2h.golsCasa + '–' + h2h.golsFora, 'Gols no total'));
    painel.appendChild(m);

    var caixa = criar('div.tabela-caixa');
    caixa.style.marginTop = '16px';
    var t = criar('table.tabela');

    var thead = criar('thead');
    var tr = criar('tr');
    ['Data', 'Mandante', 'Placar', 'Visitante', 'Competição'].forEach(function (h) {
      tr.appendChild(criar('th', h));
    });
    thead.appendChild(tr);
    t.appendChild(thead);

    var tbody = criar('tbody');
    h2h.jogos.forEach(function (j) {
      var linha = criar('tr');
      linha.appendChild(criar('td', j.quando ? U.formatarData(j.quando) + '/' + j.quando.getUTCFullYear() : '—'));
      linha.appendChild(criar('td', j.casa.nome));
      linha.appendChild(criar('td.num', j.placarCasa + '–' + j.placarFora));
      linha.appendChild(criar('td', j.fora.nome));
      linha.appendChild(criar('td', j.liga || '—'));
      tbody.appendChild(linha);
    });
    t.appendChild(tbody);

    caixa.appendChild(t);
    painel.appendChild(caixa);

    if (metodo === 'cruzamento') {
      painel.appendChild(
        criar(
          'p.bilhete-nota',
          'A busca direta não retornou resultados; estes confrontos foram encontrados cruzando ' +
            'os últimos jogos das duas equipes, então o histórico pode estar incompleto.'
        )
      );
    }

    s.appendChild(painel);
    return s;
  }

  /* ----------------------------------------------- ficha ---------- */

  function secaoFicha(ev) {
    var s = criar('section.secao');
    s.appendChild(U.secao('Ficha da partida'));

    var painel = criar('div.painel');
    [
      ['Competição', ev.liga],
      ['Temporada', ev.temporada],
      ['Rodada', ev.rodada],
      ['Estádio', ev.local],
      ['País', ev.pais],
      ['Transmissão', ev.transmissao],
      ['Esporte', ev.esporte],
      ['Status', ev.adiado ? 'Adiado' : ev.aoVivo ? 'Em andamento' : ev.encerrado ? 'Encerrado' : 'A realizar'],
    ].forEach(function (par) {
      var l = U.linhaDado(par[0], par[1]);
      if (l) painel.appendChild(l);
    });

    s.appendChild(painel);
    return s;
  }

  /* ================================================================
     AUXILIARES
     ================================================================ */

  function metrica(valor, rotulo) {
    var m = criar('div.metrica');
    m.appendChild(criar('div.metrica-valor', valor));
    m.appendChild(criar('div.metrica-rotulo', rotulo));
    return m;
  }

  function esqueletoInicial() {
    var caixa = criar('div');
    caixa.appendChild(criar('div.esqueleto.esqueleto-alto'));
    var g = criar('div.duas-colunas');
    g.style.marginTop = '14px';
    g.appendChild(criar('div.esqueleto.esqueleto-alto'));
    g.appendChild(criar('div.esqueleto.esqueleto-alto'));
    caixa.appendChild(g);
    return caixa;
  }

  function mostrarErro(titulo, detalhe, aoTentar) {
    U.limpar(conteudo);
    conteudo.appendChild(U.erro(detalhe || titulo, aoTentar));

    var voltar = criar('p.centralizado');
    voltar.appendChild(criar('a.btn.btn-contorno', { href: 'index.html' }, 'Voltar para os jogos'));
    conteudo.appendChild(voltar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
