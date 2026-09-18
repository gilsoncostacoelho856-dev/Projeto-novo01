/* =====================================================================
   PAGINA DE DETALHES DO TIME
   Ficha, forma recente, elenco, ultimos resultados e proximos jogos.
   ===================================================================== */

(function (global) {
  'use strict';

  var U = global.UI;
  var Api = global.Api;
  var criar = U.criar;

  var conteudo;

  function iniciar() {
    conteudo = U.$('#conteudo');

    var id = U.parametro('id');
    if (!id) {
      erroSimples('Nenhum time escolhido.', 'Use a busca de times para chegar até uma equipe.');
      return;
    }

    carregar(id);
  }

  function carregar(id) {
    U.limpar(conteudo);
    conteudo.appendChild(criar('div.esqueleto.esqueleto-alto'));

    Api.time(id)
      .then(function (r) {
        if (!r.dados) throw new Api.ErroApi('Time não encontrado.', 'formato');

        var time = r.dados;
        document.title = time.nome + ' — Placar Analítico';

        U.limpar(conteudo);
        conteudo.appendChild(perfil(time));

        var ficha = criar('div.duas-colunas');
        ficha.appendChild(painelFicha(time));
        ficha.appendChild(criar('div', { id: 'painel-forma' }));
        conteudo.appendChild(ficha);

        conteudo.appendChild(criar('section.secao', { id: 'secao-resultados' }));
        conteudo.appendChild(criar('section.secao', { id: 'secao-proximos' }));
        conteudo.appendChild(criar('section.secao', { id: 'secao-elenco' }));

        if (time.descricao) conteudo.appendChild(painelSobre(time));

        carregarResultados(time);
        carregarProximos(time);
        carregarElenco(time);
      })
      .catch(function (e) {
        U.limpar(conteudo);
        conteudo.appendChild(
          U.erro(Api.mensagemAmigavel(e), function () {
            carregar(id);
          })
        );
      });
  }

  /* ================================================================
     PERFIL
     ================================================================ */

  function perfil(time) {
    var caixa = criar('div.perfil');
    caixa.appendChild(U.escudo(time.escudo || time.logo, time.nome, 88));

    var texto = criar('div');
    texto.style.minWidth = '0';
    texto.appendChild(criar('h1.perfil-nome', time.nome));

    var sub = [time.liga, time.pais].filter(Boolean).join(' · ');
    if (sub) texto.appendChild(criar('p.perfil-sub', sub));

    var tags = criar('div.perfil-tags');
    if (time.esporte) tags.appendChild(criar('span.tag', time.esporte));
    if (time.fundacao) tags.appendChild(criar('span.tag', 'Fundado em ' + time.fundacao));
    if (time.apelido) tags.appendChild(criar('span.tag', time.apelido));
    texto.appendChild(tags);

    caixa.appendChild(texto);
    return caixa;
  }

  function painelFicha(time) {
    var p = criar('div.painel');
    p.appendChild(criar('h2.painel-titulo', 'Ficha'));

    [
      ['Competição', time.liga],
      ['País', time.pais],
      ['Estádio', time.estadio],
      ['Capacidade', time.capacidade ? time.capacidade.toLocaleString('pt-BR') + ' lugares' : null],
      ['Localização', time.localizacao],
      ['Fundado', time.fundacao],
    ].forEach(function (par) {
      var l = U.linhaDado(par[0], par[1]);
      if (l) p.appendChild(l);
    });

    if (time.site) {
      var linha = criar('div.dado');
      linha.appendChild(criar('span.dado-rotulo', 'Site oficial'));
      var url = /^https?:/.test(time.site) ? time.site : 'https://' + time.site;
      linha.appendChild(criar('a.dado-valor', { href: url, target: '_blank', rel: 'noopener noreferrer' }, time.site));
      p.appendChild(linha);
    }

    return p;
  }

  function painelSobre(time) {
    var s = criar('section.secao');
    var p = criar('div.painel');
    p.appendChild(criar('h2.painel-titulo', 'Sobre o clube'));
    var texto = criar('p.rodape-texto', time.descricao);
    texto.style.fontSize = '13.5px';
    p.appendChild(texto);
    s.appendChild(p);
    return s;
  }

  /* ================================================================
     RESULTADOS  +  FORMA
     ================================================================ */

  function carregarResultados(time) {
    var secao = U.$('#secao-resultados');
    secao.appendChild(U.secao('Últimos resultados'));

    var grade = criar('div.grade');
    grade.appendChild(criar('div.esqueleto'));
    grade.appendChild(criar('div.esqueleto'));
    secao.appendChild(grade);

    Api.ultimosDoTime(time.id)
      .then(function (r) {
        U.limpar(grade);

        if (!r.dados.length) {
          grade.appendChild(
            U.vazio('Sem resultados', 'A API não retornou jogos anteriores para esta equipe.')
          );
          desenharForma(time, []);
          return;
        }

        r.dados.forEach(function (j) {
          grade.appendChild(U.cardJogo(j));
        });

        desenharForma(time, r.dados);
      })
      .catch(function (e) {
        U.limpar(grade);
        grade.appendChild(U.erro(Api.mensagemAmigavel(e)));
      });
  }

  function desenharForma(time, eventos) {
    var alvo = U.$('#painel-forma');
    U.limpar(alvo);

    var retro = global.Estatisticas.retrospecto(eventos, time.id, time.nome);
    var gols = global.Estatisticas.golsPorMando(eventos, time.id, time.nome);

    var p = criar('div.painel');
    p.appendChild(criar('h2.painel-titulo', 'Retrospecto recente'));

    if (!retro.quantidade) {
      p.appendChild(criar('p.estado-texto', 'Sem jogos com placar na base para calcular a forma.'));
      alvo.appendChild(p);
      return;
    }

    p.appendChild(criar('p.resumo-frase', retro.resumo));
    p.appendChild(U.tiraDeForma(retro.sequencia));

    var m = criar('div.metricas');
    m.style.marginTop = '14px';
    m.appendChild(metrica(String(retro.golsPro), 'Gols feitos'));
    m.appendChild(metrica(retro.vitorias + '-' + retro.empates + '-' + retro.derrotas, 'V-E-D'));
    m.appendChild(metrica(String(retro.golsContra), 'Gols sofridos'));
    m.appendChild(metrica(String(retro.golsPro - retro.golsContra), 'Saldo'));
    p.appendChild(m);

    if (gols) {
      var det = criar('div');
      det.style.marginTop = '12px';
      if (gols.jogosCasa) {
        det.appendChild(
          U.linhaDado('Como mandante', virgula(gols.casaPro) + ' feitos / ' + virgula(gols.casaContra) + ' sofridos')
        );
      }
      if (gols.jogosFora) {
        det.appendChild(
          U.linhaDado('Como visitante', virgula(gols.foraPro) + ' feitos / ' + virgula(gols.foraContra) + ' sofridos')
        );
      }
      if (det.children.length) p.appendChild(det);
    }

    alvo.appendChild(p);
  }

  /* ================================================================
     PROXIMOS JOGOS
     ================================================================ */

  function carregarProximos(time) {
    var secao = U.$('#secao-proximos');
    secao.appendChild(U.secao('Próximos jogos', 'Clique em "Ver análise" para abrir o estudo da partida.'));

    var grade = criar('div.grade');
    grade.appendChild(criar('div.esqueleto'));
    secao.appendChild(grade);

    Api.proximosDoTime(time.id)
      .then(function (r) {
        U.limpar(grade);
        if (!r.dados.length) {
          grade.appendChild(
            U.vazio('Sem jogos marcados', 'A API não retornou próximas partidas para esta equipe.')
          );
          return;
        }
        r.dados.forEach(function (j) {
          grade.appendChild(U.cardJogo(j));
        });
      })
      .catch(function () {
        U.limpar(grade);
        grade.appendChild(U.vazio('Sem jogos marcados', 'Não consegui carregar as próximas partidas.'));
      });
  }

  /* ================================================================
     ELENCO
     ================================================================ */

  function carregarElenco(time) {
    var secao = U.$('#secao-elenco');
    secao.appendChild(U.secao('Elenco'));

    var caixa = criar('div');
    caixa.appendChild(criar('div.esqueleto.esqueleto-linha'));
    secao.appendChild(caixa);

    Api.elenco(time.id, time.nome)
      .then(function (r) {
        U.limpar(caixa);

        if (!r.dados.length) {
          caixa.appendChild(
            U.avisoPremium(
              'O elenco não veio da API. Na chave de teste gratuita esse endpoint costuma responder ' +
                'vazio — com o plano pago ele funciona sem mudar nada no código, só a chave em js/config.js.'
            )
          );
          return;
        }

        var lista = criar('div.jogadores');

        /* Goleiro, defesa, meio e ataque em ordem util. */
        var ordem = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
        r.dados
          .slice()
          .sort(function (a, b) {
            var ia = ordem.indexOf(a.posicao);
            var ib = ordem.indexOf(b.posicao);
            if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            return (a.nome || '').localeCompare(b.nome || '');
          })
          .forEach(function (j) {
            lista.appendChild(itemJogador(j));
          });

        caixa.appendChild(lista);
        caixa.appendChild(
          criar('p.bilhete-nota', r.dados.length + ' jogador(es) na base. Clique para ver a ficha completa.')
        );
      })
      .catch(function () {
        U.limpar(caixa);
        caixa.appendChild(U.avisoPremium('Não consegui carregar o elenco desta equipe.'));
      });
  }

  function itemJogador(j) {
    var a = criar('a.jogador-item', { href: 'jogador.html?id=' + encodeURIComponent(j.id) });
    a.appendChild(U.escudo(j.foto, j.nome, 38));

    var texto = criar('div');
    texto.style.minWidth = '0';
    texto.appendChild(criar('div.jogador-nome', j.nome));
    texto.appendChild(criar('div.jogador-pos', U.traduzirPosicao(j.posicao) || j.esporte || ''));
    a.appendChild(texto);

    if (j.numero) a.appendChild(criar('span.jogador-num', j.numero));
    return a;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
