/* =====================================================================
   ESTATISTICAS FACTUAIS

   Este arquivo substituiu o antigo modelo.js, e a diferenca importa.

   O QUE ELE FAZ: conta. Le os placares que a TheSportsDB devolve e
   soma vitorias, empates, derrotas e gols. Nada aqui e estimado,
   projetado ou ponderado — cada numero exibido pode ser conferido na
   mao, olhando a lista de jogos que a propria pagina mostra ao lado.

   O QUE ELE NAO FAZ, E POR QUE:
   a versao anterior calculava probabilidade de cada resultado (Poisson),
   odd justa (1/probabilidade) e um "indice de confianca". A matematica
   era real e os dados tambem, mas o modelo nunca foi calibrado: ninguem
   verificou se aquilo que ele chamava de 62% acontecia 62% das vezes.
   Os pesos eram escolhidos no olho, a amostra era de 5 jogos, e o
   indice de confianca era uma formula sem respaldo em metodo publicado.

   Numero nao calibrado, exibido com casa decimal, ao lado de um botao
   de aposta, empresta uma autoridade que ele nao tem — e quem le pode
   perder dinheiro de verdade por causa disso. Por isso saiu.

   Se um dia voce quiser projecao de probabilidade de volta, o caminho
   honesto tem tres etapas, nesta ordem: (1) uma fonte com histórico
   longo, nao 5 jogos; (2) backtest medindo se as previsoes batem com o
   que aconteceu; (3) so entao exibir, junto com o resultado do backtest.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;

  /* ================================================================
     LEITURA DE UM JOGO
     ================================================================ */

  /**
   * Olha uma partida do ponto de vista de um time.
   * Devolve null se o jogo nao tem placar (ainda nao aconteceu) ou se
   * aquele time nao jogou essa partida.
   */
  function perspectiva(evento, idTime, nomeTime) {
    if (!evento || !evento.temPlacar) return null;

    var emCasa;
    if (idTime && evento.casa.id && evento.fora.id) {
      emCasa = String(evento.casa.id) === String(idTime);
      if (!emCasa && String(evento.fora.id) !== String(idTime)) return null;
    } else if (nomeTime) {
      var alvo = nomeTime.trim().toLowerCase();
      if (evento.casa.nome.trim().toLowerCase() === alvo) emCasa = true;
      else if (evento.fora.nome.trim().toLowerCase() === alvo) emCasa = false;
      else return null;
    } else {
      return null;
    }

    var pro = emCasa ? evento.placarCasa : evento.placarFora;
    var contra = emCasa ? evento.placarFora : evento.placarCasa;

    return {
      evento: evento,
      emCasa: emCasa,
      adversario: emCasa ? evento.fora.nome : evento.casa.nome,
      golsPro: pro,
      golsContra: contra,
      resultado: pro > contra ? 'V' : pro < contra ? 'D' : 'E',
      quando: evento.quando,
    };
  }

  /* ================================================================
     RETROSPECTO RECENTE
     ================================================================ */

  /**
   * Conta o retrospecto de um time nos ultimos jogos.
   * Sem pesos, sem decaimento por antiguidade: um jogo é um jogo.
   * O `resumo` sai pronto em texto porque é assim que a pagina mostra —
   * uma frase que o leitor confere contra a lista de jogos ao lado.
   */
  function retrospecto(eventos, idTime, nomeTime, janela) {
    var limite = janela || C.estatisticas.janelaJogos;

    var jogos = (eventos || [])
      .map(function (e) {
        return perspectiva(e, idTime, nomeTime);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return (b.quando ? b.quando.getTime() : 0) - (a.quando ? a.quando.getTime() : 0);
      })
      .slice(0, limite);

    if (!jogos.length) {
      return {
        jogos: [],
        quantidade: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        mediaPro: null,
        mediaContra: null,
        sequencia: [],
        resumo: 'Sem jogos com placar registrado na API.',
      };
    }

    var v = 0,
      e = 0,
      d = 0,
      gp = 0,
      gc = 0;

    jogos.forEach(function (j) {
      if (j.resultado === 'V') v++;
      else if (j.resultado === 'E') e++;
      else d++;
      gp += j.golsPro;
      gc += j.golsContra;
    });

    return {
      jogos: jogos,
      quantidade: jogos.length,
      vitorias: v,
      empates: e,
      derrotas: d,
      golsPro: gp,
      golsContra: gc,
      mediaPro: gp / jogos.length,
      mediaContra: gc / jogos.length,
      sequencia: jogos.map(function (j) {
        return j.resultado;
      }),
      resumo: frase(nomeTime, v, e, d, jogos.length),
    };
  }

  function frase(nome, v, e, d, total) {
    var partes = [];
    if (v) partes.push(v === 1 ? 'venceu 1' : 'venceu ' + v);
    if (e) partes.push(e === 1 ? 'empatou 1' : 'empatou ' + e);
    if (d) partes.push(d === 1 ? 'perdeu 1' : 'perdeu ' + d);

    var lista =
      partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0] || '';

    return (nome || 'A equipe') + ' ' + lista + ' dos últimos ' + total + ' jogos.';
  }

  /* ================================================================
     GOLS POR MANDO
     ================================================================ */

  /**
   * Media de gols separando jogos em casa de jogos fora.
   * Devolve null para o recorte que nao tiver nenhum jogo — melhor
   * mostrar "sem dados" do que repetir a media geral e dar a impressao
   * de que existe informacao onde nao existe.
   */
  function golsPorMando(eventos, idTime, nomeTime) {
    var jogos = (eventos || [])
      .map(function (e) {
        return perspectiva(e, idTime, nomeTime);
      })
      .filter(Boolean);

    if (!jogos.length) return null;

    var casa = jogos.filter(function (j) {
      return j.emCasa;
    });
    var fora = jogos.filter(function (j) {
      return !j.emCasa;
    });

    function media(arr, campo) {
      if (!arr.length) return null;
      var s = 0;
      arr.forEach(function (j) {
        s += j[campo];
      });
      return s / arr.length;
    }

    return {
      amostra: jogos.length,
      jogosCasa: casa.length,
      jogosFora: fora.length,
      casaPro: media(casa, 'golsPro'),
      casaContra: media(casa, 'golsContra'),
      foraPro: media(fora, 'golsPro'),
      foraContra: media(fora, 'golsContra'),
      geralPro: media(jogos, 'golsPro'),
      geralContra: media(jogos, 'golsContra'),
    };
  }

  /* ================================================================
     CONFRONTOS DIRETOS
     ================================================================ */

  /**
   * Conta o historico entre duas equipes.
   * Como o mandante muda a cada confronto, o placar de cada jogo e lido
   * do ponto de vista do time passado em `casa` — senao a contagem sairia
   * errada em jogos disputados no campo do adversario.
   */
  function confrontos(eventos, casa, fora) {
    var validos = (eventos || []).filter(function (e) {
      return e && e.temPlacar;
    });

    if (!validos.length) {
      return {
        quantidade: 0,
        vitoriasCasa: 0,
        empates: 0,
        vitoriasFora: 0,
        golsCasa: 0,
        golsFora: 0,
        mediaGols: null,
        jogos: [],
        resumo: 'A API não retornou confrontos anteriores entre as duas equipes.',
      };
    }

    var vc = 0,
      emp = 0,
      vf = 0,
      gCasa = 0,
      gFora = 0;

    validos.forEach(function (ev) {
      var mandanteEhNosso =
        mesmoNome(ev.casa.nome, casa.nome) || (casa.id && String(ev.casa.id) === String(casa.id));

      var nossos = mandanteEhNosso ? ev.placarCasa : ev.placarFora;
      var deles = mandanteEhNosso ? ev.placarFora : ev.placarCasa;

      gCasa += nossos;
      gFora += deles;

      if (nossos > deles) vc++;
      else if (nossos < deles) vf++;
      else emp++;
    });

    var totalGols = gCasa + gFora;

    return {
      quantidade: validos.length,
      vitoriasCasa: vc,
      empates: emp,
      vitoriasFora: vf,
      golsCasa: gCasa,
      golsFora: gFora,
      mediaGols: totalGols / validos.length,
      jogos: validos,
      resumo:
        'Nos ' + validos.length + ' confrontos registrados: ' + vc + ' vitória(s) do ' + casa.nome +
        ', ' + emp + ' empate(s) e ' + vf + ' vitória(s) do ' + fora.nome + '.',
    };
  }

  function mesmoNome(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  /* ================================================================
     COMPARACAO ENTRE DUAS EQUIPES

     Devolve as duas colunas de numeros lado a lado. Repare que NAO
     existe um campo "favorito", "chance" ou "indicacao": a leitura de
     quem esta melhor fica com quem olha a tabela, que e onde ela deve
     ficar.
     ================================================================ */

  function comparar(entrada) {
    var casa = entrada.casa || {};
    var fora = entrada.fora || {};

    return {
      casa: casa,
      fora: fora,
      esporte: entrada.esporte || '',
      retrospectoCasa: retrospecto(entrada.ultimosCasa, casa.id, casa.nome),
      retrospectoFora: retrospecto(entrada.ultimosFora, fora.id, fora.nome),
      golsCasa: golsPorMando(entrada.ultimosCasa, casa.id, casa.nome),
      golsFora: golsPorMando(entrada.ultimosFora, fora.id, fora.nome),
      confrontos: confrontos(entrada.confrontos, casa, fora),
    };
  }

  global.Estatisticas = {
    perspectiva: perspectiva,
    retrospecto: retrospecto,
    golsPorMando: golsPorMando,
    confrontos: confrontos,
    comparar: comparar,
  };
})(window);
