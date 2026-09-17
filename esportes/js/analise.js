/* =====================================================================
   PAGINA DE ANALISE DE UMA PARTIDA

   Junta em uma tela: confrontos diretos, forma recente dos dois times,
   medias de gols, leitura de probabilidade e as sugestoes de aposta.

   A pagina precisa de ate 5 chamadas de API. Todas passam pela fila do
   api.js, entao nunca disparam de uma vez so.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;
  var U = global.UI;
  var Api = global.Api;
  var criar = U.criar;

  var conteudo;

  function iniciar() {
    conteudo = U.$('#conteudo');

    var idEvento = U.parametro('evento');
    if (!idEvento) {
      mostrarErro('Nenhuma partida escolhida.', 'Volte para a lista de jogos e clique em "Ver análise".');
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
        if (!r.dados) {
          throw new Api.ErroApi('Partida não encontrada na base de dados.', 'formato');
        }
        return carregarContexto(r.dados);
      })
      .catch(function (erro) {
        mostrarErro(Api.mensagemAmigavel(erro), null, function () {
          carregar(idEvento);
        });
      });
  }

  function carregarContexto(ev) {
    /* Sem id de time nao da para buscar historico. Acontece em esportes
       individuais e em jogos muito antigos da base. */
    var temIds = ev.casa.id && ev.fora.id;

    var promessas = [
      temIds ? Api.ultimosDoTime(ev.casa.id).catch(vazio) : Promise.resolve({ dados: [] }),
      temIds ? Api.ultimosDoTime(ev.fora.id).catch(vazio) : Promise.resolve({ dados: [] }),
      Api.confrontos(ev.casa.nome, ev.fora.nome, ev.casa.id, ev.fora.id).catch(vazio),
    ];

    return Promise.all(promessas).then(function (res) {
      var ultimosCasa = res[0].dados;
      var ultimosFora = res[1].dados;
      var h2h = res[2].dados;

      /* O jogo que estamos analisando nao pode entrar na propria conta. */
      var semEle = function (lista) {
        return lista.filter(function (j) {
          return j.id !== ev.id;
        });
      };

      var analise = global.Modelo.analisar({
        casa: ev.casa,
        fora: ev.fora,
        ultimosCasa: semEle(ultimosCasa),
        ultimosFora: semEle(ultimosFora),
        confrontos: semEle(h2h),
        esporte: ev.esporte,
      });

      desenhar(ev, analise, res[2].metodo);
    });
  }

  function vazio() {
    return { dados: [] };
  }

  /* ================================================================
     DESENHO
     ================================================================ */

  function desenhar(ev, analise, metodoH2h) {
    U.limpar(conteudo);

    conteudo.appendChild(cabecalhoConfronto(ev));

    if (ev.temPlacar) {
      conteudo.appendChild(
        U.avisoDados(
          'Esta partida já tem placar registrado. A análise abaixo usa apenas os jogos ' +
            'anteriores a ela, mas serve mais como estudo do que como sugestão.'
        )
      );
    }

    conteudo.appendChild(secaoSugestoes(ev, analise));
    conteudo.appendChild(secaoProbabilidades(ev, analise));
    conteudo.appendChild(secaoForma(ev, analise));
    conteudo.appendChild(secaoConfrontos(ev, analise, metodoH2h));
    conteudo.appendChild(secaoEstatisticas(ev, analise));
    conteudo.appendChild(secaoComoLer(analise));
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

  /* ---------------------------------------------- sugestoes ------- */

  function secaoSugestoes(ev, analise) {
    var s = criar('section.secao');
    s.appendChild(
      U.secao(
        '🎯 Sugestões para esta partida',
        'Ordenadas por índice de confiança, apenas com odd justa a partir de ' +
          global.Bilhete.formatarOdd(C.apostas.oddMinima) + '.'
      )
    );

    var sugestoes = global.Bilhete.sugestoesDe(analise, 4);

    if (!sugestoes.length) {
      s.appendChild(U.vazio('Sem sugestão nesta partida', global.Bilhete.motivoListaVazia()));
      return s;
    }

    var grade = criar('div.grade');
    sugestoes.forEach(function (sug, i) {
      grade.appendChild(global.Bilhete.montar(sug, ev, { destaque: i === 0, comLink: false }));
    });
    s.appendChild(grade);

    return s;
  }

  /* ------------------------------------------ probabilidades ------ */

  function secaoProbabilidades(ev, analise) {
    var s = criar('section.secao');
    s.appendChild(U.secao('Leitura do modelo', 'Probabilidade estimada para cada resultado.'));

    var painel = criar('div.painel');
    painel.appendChild(U.barraTripla(analise.probabilidades, ev.casa.nome, ev.fora.nome));

    if (analise.usaPoisson) {
      var metricas = criar('div.metricas');
      metricas.style.marginTop = '18px';
      metricas.appendChild(metrica(analise.lambdaCasa.toFixed(2), 'Gols esp. ' + U.abreviar(ev.casa.nome)));
      metricas.appendChild(metrica(analise.lambdaFora.toFixed(2), 'Gols esp. ' + U.abreviar(ev.fora.nome)));
      metricas.appendChild(metrica((analise.lambdaCasa + analise.lambdaFora).toFixed(2), 'Total esperado'));
      metricas.appendChild(metrica(Math.round(analise.amostra * 100) + '%', 'Qualidade da amostra'));
      painel.appendChild(metricas);
    }

    s.appendChild(painel);

    /* placares mais provaveis */
    if (analise.placaresProvaveis.length) {
      var p2 = criar('div.painel');
      p2.style.marginTop = '12px';
      p2.appendChild(criar('h3.painel-titulo', 'Placares mais prováveis'));

      var caixa = criar('div.tabela-caixa');
      var t = criar('table.tabela');

      var thead = criar('thead');
      var tr = criar('tr');
      ['Placar', 'Probabilidade', 'Odd justa'].forEach(function (h) {
        tr.appendChild(criar('th', h));
      });
      thead.appendChild(tr);
      t.appendChild(thead);

      var tbody = criar('tbody');
      analise.placaresProvaveis.forEach(function (pl) {
        var linha = criar('tr');
        linha.appendChild(criar('td.num', pl.casa + ' – ' + pl.fora));
        linha.appendChild(criar('td.num', (pl.p * 100).toFixed(1).replace('.', ',') + '%'));
        linha.appendChild(criar('td.num', global.Bilhete.formatarOdd(1 / pl.p)));
        tbody.appendChild(linha);
      });
      t.appendChild(tbody);

      caixa.appendChild(t);
      p2.appendChild(caixa);
      s.appendChild(p2);
    }

    return s;
  }

  function metrica(valor, rotulo) {
    var m = criar('div.metrica');
    m.appendChild(criar('div.metrica-valor', valor));
    m.appendChild(criar('div.metrica-rotulo', rotulo));
    return m;
  }

  /* ------------------------------------------------- forma -------- */

  function secaoForma(ev, analise) {
    var s = criar('section.secao');
    s.appendChild(U.secao('Forma recente', 'Os últimos jogos de cada equipe, do mais antigo para o mais novo.'));

    var colunas = criar('div.duas-colunas');
    colunas.appendChild(painelForma(ev.casa, analise.formaCasa, analise.golsCasa));
    colunas.appendChild(painelForma(ev.fora, analise.formaFora, analise.golsFora));
    s.appendChild(colunas);

    return s;
  }

  function painelForma(time, forma, gols) {
    var p = criar('div.painel');

    var topo = criar('div');
    topo.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px';
    topo.appendChild(U.escudo(time.escudo, time.nome, 36));
    topo.appendChild(criar('strong', time.nome || '—'));
    p.appendChild(topo);

    if (!forma.quantidade) {
      p.appendChild(
        criar('p.estado-texto', 'A API não devolveu jogos anteriores com placar para esta equipe.')
      );
      return p;
    }

    p.appendChild(U.tiraDeForma(forma.sequencia));

    var m = criar('div.metricas');
    m.style.marginTop = '14px';
    m.appendChild(metrica(forma.aproveitamento + '%', 'Aproveitamento'));
    m.appendChild(metrica(forma.vitorias + '-' + forma.empates + '-' + forma.derrotas, 'V-E-D'));
    m.appendChild(metrica(forma.mediaPro.toFixed(1).replace('.', ','), 'Gols/jogo'));
    m.appendChild(metrica(forma.mediaContra.toFixed(1).replace('.', ','), 'Sofridos/jogo'));
    p.appendChild(m);

    if (gols && gols.jogosCasa && gols.jogosFora) {
      var detalhes = criar('div');
      detalhes.style.marginTop = '12px';
      detalhes.appendChild(
        U.linhaDado(
          'Em casa',
          gols.casaPro.toFixed(1).replace('.', ',') + ' feitos / ' +
            gols.casaContra.toFixed(1).replace('.', ',') + ' sofridos'
        )
      );
      detalhes.appendChild(
        U.linhaDado(
          'Fora',
          gols.foraPro.toFixed(1).replace('.', ',') + ' feitos / ' +
            gols.foraContra.toFixed(1).replace('.', ',') + ' sofridos'
        )
      );
      p.appendChild(detalhes);
    }

    /* lista dos jogos */
    var lista = criar('div');
    lista.style.marginTop = '12px';
    forma.jogos.forEach(function (j) {
      var e = j.evento;
      var linha = criar('div.dado');

      var esq = criar('span.dado-rotulo');
      esq.textContent = (e.casa.nome === time.nome ? e.fora.nome : e.casa.nome) + (j.emCasa ? ' (casa)' : ' (fora)');
      linha.appendChild(esq);

      var dir = criar('span.dado-valor');
      dir.textContent = j.golsPro + '–' + j.golsContra;
      dir.className += j.resultado === 'V' ? ' destaque-v' : j.resultado === 'D' ? ' destaque-d' : '';
      linha.appendChild(dir);

      lista.appendChild(linha);
    });
    p.appendChild(lista);

    return p;
  }

  /* --------------------------------------------- confrontos ------- */

  function secaoConfrontos(ev, analise, metodo) {
    var s = criar('section.secao');
    var h2h = analise.confrontos;

    s.appendChild(
      U.secao(
        'Confrontos diretos',
        h2h.quantidade
          ? 'Os últimos ' + h2h.quantidade + ' jogos entre as duas equipes na base da TheSportsDB.'
          : 'Histórico entre as duas equipes.'
      )
    );

    if (!h2h.quantidade) {
      s.appendChild(
        U.vazio(
          'Sem histórico disponível',
          'A API não retornou confrontos anteriores entre ' + ev.casa.nome + ' e ' + ev.fora.nome +
            '. O modelo redistribuiu esse peso para a forma recente e para as médias de gols.'
        )
      );
      return s;
    }

    var painel = criar('div.painel');

    var m = criar('div.metricas');
    m.appendChild(metrica(String(h2h.vitoriasCasa), 'Vit. ' + U.abreviar(ev.casa.nome)));
    m.appendChild(metrica(String(h2h.empates), 'Empates'));
    m.appendChild(metrica(String(h2h.vitoriasFora), 'Vit. ' + U.abreviar(ev.fora.nome)));
    m.appendChild(metrica(h2h.mediaGols.toFixed(1).replace('.', ','), 'Gols/jogo'));
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
          'A busca direta não retornou resultados; estes confrontos foram encontrados ' +
            'cruzando os últimos jogos das duas equipes, então o histórico pode estar incompleto.'
        )
      );
    }

    s.appendChild(painel);
    return s;
  }

  /* ------------------------------------------ estatisticas -------- */

  function secaoEstatisticas(ev, analise) {
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
      var linha = U.linhaDado(par[0], par[1]);
      if (linha) painel.appendChild(linha);
    });

    s.appendChild(painel);
    return s;
  }

  /* ---------------------------------------------- como ler -------- */

  function secaoComoLer(analise) {
    var s = criar('section.secao');

    var aviso = criar('div.aviso-modelo');
    aviso.appendChild(criar('h3', 'Como ler estes números'));

    aviso.appendChild(
      criar(
        'p',
        'O índice de confiança é a probabilidade do modelo ajustada pelo tamanho da amostra. ' +
          'Aqui ele trabalhou com ' + analise.formaCasa.quantidade + ' e ' + analise.formaFora.quantidade +
          ' jogos recentes e ' + analise.confrontos.quantidade + ' confrontos diretos — ' +
          'qualidade de amostra de ' + Math.round(analise.amostra * 100) + '%.'
      )
    );

    aviso.appendChild(
      criar(
        'p',
        'A odd justa é o inverso da probabilidade. Compare com a odd da casa: se a casa paga MAIS que ' +
          'a justa, o preço está do seu lado; se paga menos, a vantagem é dela.'
      )
    );

    aviso.appendChild(
      criar(
        'p',
        'O que o modelo NÃO sabe: lesão, suspensão, time reserva, mudança de técnico, ' +
          'clima, arbitragem e sorte. Isso decide muita partida. Por isso o teto do índice é ' +
          C.modelo.confiancaMaxima + '% — não existe aposta de 100%, e quem te promete isso ' +
          'está vendendo alguma coisa.'
      )
    );

    s.appendChild(aviso);
    return s;
  }

  /* ================================================================
     AUXILIARES
     ================================================================ */

  function esqueletoInicial() {
    var caixa = criar('div');
    caixa.appendChild(criar('div.esqueleto.esqueleto-alto'));
    var g = criar('div.grade');
    g.style.marginTop = '14px';
    for (var i = 0; i < 4; i++) g.appendChild(criar('div.esqueleto'));
    caixa.appendChild(g);
    return caixa;
  }

  function mostrarErro(titulo, detalhe, aoTentar) {
    U.limpar(conteudo);
    var e = U.erro(detalhe || titulo, aoTentar);
    conteudo.appendChild(e);

    var voltar = criar('p');
    voltar.style.cssText = 'text-align:center;margin-top:16px';
    voltar.appendChild(criar('a.btn.btn-contorno', { href: 'index.html' }, 'Voltar para os jogos'));
    conteudo.appendChild(voltar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
