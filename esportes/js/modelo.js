/* =====================================================================
   MODELO ESTATISTICO

   O que este arquivo faz, em uma frase: pega os ultimos jogos de cada
   time e o historico entre os dois, estima quantos gols cada lado tende
   a fazer, e transforma isso em probabilidade para cada mercado.

   COMO FUNCIONA (vale a pena ler antes de mexer):

   1. FORMA — os ultimos jogos viram pontos (V=3, E=1, D=0). Jogo mais
      recente pesa mais que jogo antigo.

   2. CONFRONTOS DIRETOS — o mesmo calculo, so que nos jogos entre os
      dois times. Se nunca se enfrentaram, este peso e redistribuido.

   3. ATAQUE E DEFESA — media de gols marcados e sofridos, separando
      jogos em casa de jogos fora.

   4. POISSON — com as medias acima o modelo estima `lambda` (gols
      esperados) de cada lado e monta uma matriz de placares 0x0 ate 8x8.
      Somar as celulas certas da a probabilidade de cada mercado.
      E o mesmo metodo que as casas de aposta usam como ponto de partida.

   5. INDICE DE CONFIANCA — a probabilidade do modelo, PENALIZADA pela
      quantidade de dados disponiveis. Cinco jogos e pouca amostra, e o
      indice reflete isso honestamente.

   IMPORTANTE, E NAO E DISCLAIMER DE FACHADA:
   este indice e a leitura de um modelo estatistico sobre dados passados.
   Ele nao preve o futuro. Lesao, expulsao, time reserva, arbitragem e
   sorte pura nao estao em lugar nenhum desta conta. Por isso o teto e
   `CONFIG.modelo.confiancaMaxima` — qualquer numero perto de 100% seria
   mentira, independente do que a estatistica mostre.
   ===================================================================== */

(function (global) {
  'use strict';

  var M = global.CONFIG.modelo;
  var A = global.CONFIG.apostas;

  /* Esportes onde o placar e baixo e Poisson descreve bem o jogo. */
  var ESPORTES_POISSON = ['Soccer', 'Ice Hockey', 'Handball', 'Rugby'];

  /* Esportes sem mando de campo relevante. */
  var SEM_MANDO = ['Fighting', 'Tennis', 'Motorsport', 'Golf'];

  /* ================================================================
     MATEMATICA BASICA
     ================================================================ */

  function fatorial(n) {
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  /** Probabilidade de sair exatamente `k` gols quando a media e `lambda`. */
  function poisson(k, lambda) {
    if (lambda <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / fatorial(k);
  }

  function limitar(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function media(nums) {
    if (!nums.length) return 0;
    var s = 0;
    for (var i = 0; i < nums.length; i++) s += nums[i];
    return s / nums.length;
  }

  /* ================================================================
     LEITURA DOS JOGOS
     ================================================================ */

  /**
   * Olha um jogo do ponto de vista de um time.
   * Devolve null se o jogo nao tem placar (ainda nao aconteceu).
   */
  function perspectiva(evento, idTime, nomeTime) {
    if (!evento || !evento.temPlacar) return null;

    var ehCasa;
    if (idTime && evento.casa.id && evento.fora.id) {
      ehCasa = String(evento.casa.id) === String(idTime);
      if (!ehCasa && String(evento.fora.id) !== String(idTime)) return null;
    } else if (nomeTime) {
      var alvo = nomeTime.toLowerCase();
      if (evento.casa.nome.toLowerCase() === alvo) ehCasa = true;
      else if (evento.fora.nome.toLowerCase() === alvo) ehCasa = false;
      else return null;
    } else {
      return null;
    }

    var pro = ehCasa ? evento.placarCasa : evento.placarFora;
    var contra = ehCasa ? evento.placarFora : evento.placarCasa;

    return {
      evento: evento,
      emCasa: ehCasa,
      golsPro: pro,
      golsContra: contra,
      resultado: pro > contra ? 'V' : pro < contra ? 'D' : 'E',
      pontos: pro > contra ? 3 : pro === contra ? 1 : 0,
      quando: evento.quando,
    };
  }

  /**
   * Resumo da forma recente de um time.
   * O peso cai conforme o jogo envelhece: o ultimo jogo vale 1.0,
   * o anterior 0.85, e assim por diante.
   */
  function forma(eventos, idTime, nomeTime, janela) {
    var n = janela || M.janelaForma;

    var jogos = (eventos || [])
      .map(function (e) {
        return perspectiva(e, idTime, nomeTime);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return (b.quando ? b.quando.getTime() : 0) - (a.quando ? a.quando.getTime() : 0);
      })
      .slice(0, n);

    if (!jogos.length) {
      return {
        jogos: [],
        quantidade: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        pontos: 0,
        sequencia: [],
        golsPro: 0,
        golsContra: 0,
        mediaPro: 0,
        mediaContra: 0,
        aproveitamento: 0,
        indice: 0.5, // sem dado: neutro
      };
    }

    var v = 0,
      e = 0,
      d = 0,
      gp = 0,
      gc = 0;
    var pesoTotal = 0;
    var pontosPesados = 0;

    jogos.forEach(function (j, i) {
      if (j.resultado === 'V') v++;
      else if (j.resultado === 'E') e++;
      else d++;
      gp += j.golsPro;
      gc += j.golsContra;

      var peso = Math.pow(0.85, i);
      pesoTotal += peso;
      pontosPesados += j.pontos * peso;
    });

    /* indice de 0 a 1: 1 = venceu tudo, 0 = perdeu tudo. */
    var indice = pesoTotal > 0 ? pontosPesados / (3 * pesoTotal) : 0.5;

    return {
      jogos: jogos,
      quantidade: jogos.length,
      vitorias: v,
      empates: e,
      derrotas: d,
      pontos: v * 3 + e,
      sequencia: jogos.map(function (j) {
        return j.resultado;
      }),
      golsPro: gp,
      golsContra: gc,
      mediaPro: gp / jogos.length,
      mediaContra: gc / jogos.length,
      aproveitamento: Math.round(((v * 3 + e) / (jogos.length * 3)) * 100),
      indice: indice,
    };
  }

  /**
   * Medias de gols separando mandante de visitante.
   * Se o time nao tem jogo em casa na amostra, usa a media geral.
   */
  function mediasGols(eventos, idTime, nomeTime) {
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

    function med(arr, campo) {
      return media(
        arr.map(function (j) {
          return j[campo];
        })
      );
    }

    var geralPro = med(jogos, 'golsPro');
    var geralContra = med(jogos, 'golsContra');

    return {
      amostra: jogos.length,
      geralPro: geralPro,
      geralContra: geralContra,
      casaPro: casa.length ? med(casa, 'golsPro') : geralPro,
      casaContra: casa.length ? med(casa, 'golsContra') : geralContra,
      foraPro: fora.length ? med(fora, 'golsPro') : geralPro,
      foraContra: fora.length ? med(fora, 'golsContra') : geralContra,
      jogosCasa: casa.length,
      jogosFora: fora.length,
    };
  }

  /**
   * Resumo do historico direto entre os dois times.
   */
  function resumoConfrontos(eventos, casa, fora) {
    var validos = (eventos || []).filter(function (e) {
      return e && e.temPlacar;
    });

    if (!validos.length) {
      return { quantidade: 0, vitoriasCasa: 0, empates: 0, vitoriasFora: 0, mediaGols: 0, indiceCasa: 0.5, jogos: [] };
    }

    var vc = 0,
      emp = 0,
      vf = 0,
      totalGols = 0;

    validos.forEach(function (e) {
      totalGols += e.placarCasa + e.placarFora;

      /* Quem foi mandante muda a cada confronto, entao normaliza pelo
         nome do time que estamos analisando como "casa" agora. */
      var casaEraNosso = mesmoTime(e.casa.nome, casa.nome) || (casa.id && String(e.casa.id) === String(casa.id));

      var golsNossos = casaEraNosso ? e.placarCasa : e.placarFora;
      var golsDeles = casaEraNosso ? e.placarFora : e.placarCasa;

      if (golsNossos > golsDeles) vc++;
      else if (golsNossos < golsDeles) vf++;
      else emp++;
    });

    var indiceCasa = (vc * 3 + emp) / (validos.length * 3);

    return {
      quantidade: validos.length,
      vitoriasCasa: vc,
      empates: emp,
      vitoriasFora: vf,
      mediaGols: totalGols / validos.length,
      indiceCasa: indiceCasa,
      jogos: validos,
    };
  }

  function mesmoTime(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  /* ================================================================
     MATRIZ DE PLACARES
     ================================================================ */

  /**
   * Monta a tabela de probabilidade de cada placar possivel.
   * linha = gols do mandante, coluna = gols do visitante.
   */
  function matrizPlacar(lambdaCasa, lambdaFora, maxGols) {
    var max = maxGols || M.maxGolsMatriz;
    var matriz = [];
    var soma = 0;

    for (var i = 0; i <= max; i++) {
      matriz[i] = [];
      for (var j = 0; j <= max; j++) {
        var p = poisson(i, lambdaCasa) * poisson(j, lambdaFora);
        matriz[i][j] = p;
        soma += p;
      }
    }

    /* Normaliza: a cauda acima de `max` gols foi cortada. */
    if (soma > 0) {
      for (var a = 0; a <= max; a++) {
        for (var b = 0; b <= max; b++) matriz[a][b] /= soma;
      }
    }

    return matriz;
  }

  /** Soma as celulas da matriz que satisfazem uma condicao. */
  function somar(matriz, condicao) {
    var total = 0;
    for (var i = 0; i < matriz.length; i++) {
      for (var j = 0; j < matriz[i].length; j++) {
        if (condicao(i, j)) total += matriz[i][j];
      }
    }
    return total;
  }

  /* ================================================================
     ANALISE COMPLETA
     ================================================================ */

  /**
   * @param {Object} entrada
   *   casa         {id, nome}
   *   fora         {id, nome}
   *   ultimosCasa  [evento] — ultimos jogos do mandante
   *   ultimosFora  [evento] — ultimos jogos do visitante
   *   confrontos   [evento] — historico direto
   *   esporte      string
   */
  function analisar(entrada) {
    var casa = entrada.casa || {};
    var fora = entrada.fora || {};
    var esporte = entrada.esporte || 'Soccer';

    var usaPoisson = ESPORTES_POISSON.indexOf(esporte) >= 0;
    var temMando = SEM_MANDO.indexOf(esporte) < 0;

    var formaCasa = forma(entrada.ultimosCasa, casa.id, casa.nome);
    var formaFora = forma(entrada.ultimosFora, fora.id, fora.nome);
    var golsCasa = mediasGols(entrada.ultimosCasa, casa.id, casa.nome);
    var golsFora = mediasGols(entrada.ultimosFora, fora.id, fora.nome);
    var h2h = resumoConfrontos(entrada.confrontos, casa, fora);

    /* ---- forca de cada lado (0 a 1) ---------------------------- */

    var pesos = redistribuirPesos(h2h.quantidade > 0, !!(golsCasa && golsFora));

    var forcaCasa =
      pesos.forma * formaCasa.indice +
      pesos.confrontos * h2h.indiceCasa +
      pesos.gols * indiceAtaqueDefesa(golsCasa, golsFora, true);

    var forcaFora =
      pesos.forma * formaFora.indice +
      pesos.confrontos * (1 - h2h.indiceCasa) +
      pesos.gols * indiceAtaqueDefesa(golsFora, golsCasa, false);

    if (temMando) forcaCasa *= M.fatorCasa;

    /* ---- gols esperados --------------------------------------- */

    var lambdaCasa = null;
    var lambdaFora = null;
    var matriz = null;

    if (usaPoisson && golsCasa && golsFora) {
      /* O ataque de um encontra a defesa do outro. */
      lambdaCasa = Math.max(0.15, (golsCasa.casaPro + golsFora.foraContra) / 2);
      lambdaFora = Math.max(0.15, (golsFora.foraPro + golsCasa.casaContra) / 2);

      if (temMando) {
        lambdaCasa *= 1.06;
        lambdaFora *= 0.96;
      }

      /* Puxa levemente na direcao do historico direto, quando existe. */
      if (h2h.quantidade >= 2) {
        var alvo = h2h.mediaGols / 2;
        lambdaCasa = lambdaCasa * 0.8 + alvo * 0.2;
        lambdaFora = lambdaFora * 0.8 + alvo * 0.2;
      }

      matriz = matrizPlacar(lambdaCasa, lambdaFora);
    }

    /* ---- probabilidade do resultado --------------------------- */

    var prob;
    if (matriz) {
      prob = {
        casa: somar(matriz, function (i, j) {
          return i > j;
        }),
        empate: somar(matriz, function (i, j) {
          return i === j;
        }),
        fora: somar(matriz, function (i, j) {
          return i < j;
        }),
      };
    } else {
      prob = probabilidadePorForca(forcaCasa, forcaFora, esporte);
    }

    /* ---- amostra: quanta informacao o modelo teve -------------- */

    var amostra = qualidadeAmostra(formaCasa, formaFora, h2h);

    /* ---- mercados --------------------------------------------- */

    var mercados = montarMercados({
      prob: prob,
      matriz: matriz,
      lambdaCasa: lambdaCasa,
      lambdaFora: lambdaFora,
      casa: casa,
      fora: fora,
      formaCasa: formaCasa,
      formaFora: formaFora,
      h2h: h2h,
      amostra: amostra,
      esporte: esporte,
    });

    mercados.sort(function (a, b) {
      return b.confianca - a.confianca;
    });

    /* ---- combinacoes estilo "Criar Aposta" --------------------- */

    var combos = matriz ? montarCombos(mercados, matriz, amostra) : [];

    /* ---- o que efetivamente vale sugerir ----------------------- */

    var elegiveis = mercados.filter(function (m) {
      return m.oddJusta && m.oddJusta >= A.oddMinima && m.oddJusta <= A.oddMaxima;
    });

    var simplesTop = elegiveis.length ? elegiveis[0] : null;
    var comboTop = combos.length ? combos[0] : null;

    /* Entre a simples e a combinada, fica a de maior confianca. */
    var sugestao = null;
    if (simplesTop && comboTop) sugestao = comboTop.confianca > simplesTop.confianca ? comboTop : simplesTop;
    else sugestao = simplesTop || comboTop;

    return {
      combos: combos,
      elegiveis: elegiveis,
      sugestao: sugestao,
      casa: casa,
      fora: fora,
      esporte: esporte,
      usaPoisson: !!matriz,
      formaCasa: formaCasa,
      formaFora: formaFora,
      golsCasa: golsCasa,
      golsFora: golsFora,
      confrontos: h2h,
      forcaCasa: forcaCasa,
      forcaFora: forcaFora,
      lambdaCasa: lambdaCasa,
      lambdaFora: lambdaFora,
      probabilidades: prob,
      placaresProvaveis: matriz ? placaresMaisProvaveis(matriz, 5) : [],
      amostra: amostra,
      mercados: mercados,
      melhor: mercados.length ? mercados[0] : null,
    };
  }

  /**
   * Quando falta um ingrediente (sem historico direto, sem placares),
   * o peso dele vai para os outros em vez de virar zero silencioso.
   */
  function redistribuirPesos(temH2h, temGols) {
    var p = { forma: M.pesos.forma, confrontos: M.pesos.confrontos, gols: M.pesos.gols };

    var sobra = 0;
    if (!temH2h) {
      sobra += p.confrontos;
      p.confrontos = 0;
    }
    if (!temGols) {
      sobra += p.gols;
      p.gols = 0;
    }

    if (sobra > 0) {
      var base = p.forma + p.confrontos + p.gols;
      if (base <= 0) return { forma: 1, confrontos: 0, gols: 0 };
      p.forma += sobra * (p.forma / base);
      p.confrontos += sobra * (p.confrontos / base);
      p.gols += sobra * (p.gols / base);
    }

    return p;
  }

  /** Ataque proprio contra defesa adversaria, em escala 0..1. */
  function indiceAtaqueDefesa(meus, deles, ehCasa) {
    if (!meus || !deles) return 0.5;

    var meuAtaque = ehCasa ? meus.casaPro : meus.foraPro;
    var defesaDeles = ehCasa ? deles.foraContra : deles.casaContra;

    var expectativa = (meuAtaque + defesaDeles) / 2;
    /* 2.5 gols esperados ja e um ataque muito forte; acima disso satura. */
    return limitar(expectativa / 2.5, 0, 1);
  }

  /** Para esportes sem Poisson: converte forca em probabilidade. */
  function probabilidadePorForca(fc, ff, esporte) {
    var total = fc + ff;
    if (total <= 0) return { casa: 0.4, empate: 0.2, fora: 0.4 };

    var diff = (fc - ff) / total; // -1 .. 1

    /* Quanto mais parelho, mais chance de empate. Em esporte que nao
       tem empate (basquete, MMA, tenis) isso vira zero. */
    var temEmpate = ['Soccer', 'Ice Hockey', 'Handball', 'American Football', 'Rugby'].indexOf(esporte) >= 0;
    var pEmpate = temEmpate ? limitar(0.28 - 0.13 * Math.abs(diff) * 2, 0.05, 0.3) : 0;

    var resto = 1 - pEmpate;
    return {
      casa: resto * limitar(0.5 + diff, 0.05, 0.95),
      empate: pEmpate,
      fora: resto * limitar(0.5 - diff, 0.05, 0.95),
    };
  }

  /**
   * De 0 a 1: quanto o modelo pode confiar na propria conta.
   * Pouca amostra derruba o indice, e e assim que tem que ser.
   */
  function qualidadeAmostra(fc, ff, h2h) {
    var jogos = fc.quantidade + ff.quantidade; // ate 10
    var diretos = Math.min(h2h.quantidade, 6); // ate 6

    var pontos = jogos / 10 + diretos / 6; // 0 a 2
    var q = limitar(pontos / 2, 0, 1);

    /* Nunca deixa a amostra zerar a analise: piso de 0.35. */
    return limitar(0.35 + q * 0.65, 0.35, 1);
  }

  function placaresMaisProvaveis(matriz, quantos) {
    var todos = [];
    for (var i = 0; i < matriz.length; i++) {
      for (var j = 0; j < matriz[i].length; j++) {
        todos.push({ casa: i, fora: j, p: matriz[i][j] });
      }
    }
    todos.sort(function (a, b) {
      return b.p - a.p;
    });
    return todos.slice(0, quantos || 5);
  }

  /* ================================================================
     MERCADOS
     ================================================================ */

  /**
   * Monta a lista de mercados.
   *
   * Repare no campo `condicao`: e uma funcao (golsCasa, golsFora) => bool
   * que diz se aquele placar faz o mercado ganhar. E ela que permite
   * combinar dois mercados DE VERDADE mais adiante — somando as celulas
   * da matriz onde as duas condicoes valem ao mesmo tempo, em vez de
   * multiplicar as odds (o que ignoraria a correlacao entre elas).
   */
  function montarMercados(ctx) {
    var lista = [];
    var p = ctx.prob;
    var nomeCasa = ctx.casa.nome || 'Mandante';
    var nomeFora = ctx.fora.nome || 'Visitante';

    /* ---- resultado (1X2) -------------------------------------- */

    var resultados = [
      {
        selecao: 'Resultado Final: ' + nomeCasa,
        p: p.casa,
        cond: function (i, j) {
          return i > j;
        },
      },
      {
        selecao: 'Resultado Final: ' + nomeFora,
        p: p.fora,
        cond: function (i, j) {
          return i < j;
        },
      },
    ];
    if (p.empate > 0.02) {
      resultados.push({
        selecao: 'Resultado Final: Empate',
        p: p.empate,
        cond: function (i, j) {
          return i === j;
        },
      });
    }

    resultados.sort(function (a, b) {
      return b.p - a.p;
    });

    lista.push(
      criar({
        familia: 'resultado',
        mercado: 'Resultado Final',
        selecao: resultados[0].selecao,
        probabilidade: resultados[0].p,
        condicao: resultados[0].cond,
        ctx: ctx,
        justificativa: justificarResultado(resultados[0], ctx),
      })
    );

    /* ---- dupla chance ----------------------------------------- */

    if (p.empate > 0.02) {
      var duplas = [
        {
          selecao: nomeCasa + ' ou empate (1X)',
          p: p.casa + p.empate,
          cond: function (i, j) {
            return i >= j;
          },
        },
        {
          selecao: nomeFora + ' ou empate (X2)',
          p: p.fora + p.empate,
          cond: function (i, j) {
            return i <= j;
          },
        },
        {
          selecao: 'Sem empate (12)',
          p: p.casa + p.fora,
          cond: function (i, j) {
            return i !== j;
          },
        },
      ];
      duplas.sort(function (a, b) {
        return b.p - a.p;
      });

      lista.push(
        criar({
          familia: 'dupla',
          mercado: 'Dupla Chance',
          selecao: duplas[0].selecao,
          probabilidade: duplas[0].p,
          condicao: duplas[0].cond,
          ctx: ctx,
          justificativa: 'Cobre dois dos três resultados, por isso paga pouco.',
        })
      );
    }

    /* ---- mercados de gols (so existem com a matriz) ------------ */

    if (ctx.matriz) {
      var total = ctx.lambdaCasa + ctx.lambdaFora;

      [1.5, 2.5, 3.5].forEach(function (linha) {
        var condAcima = function (i, j) {
          return i + j > linha;
        };
        var condAbaixo = function (i, j) {
          return i + j < linha;
        };

        var acima = somar(ctx.matriz, condAcima);
        var abaixo = 1 - acima;

        var venc =
          acima >= abaixo
            ? { selecao: 'Mais de ' + fmt(linha) + ' gols', p: acima, cond: condAcima }
            : { selecao: 'Menos de ' + fmt(linha) + ' gols', p: abaixo, cond: condAbaixo };

        lista.push(
          criar({
            familia: 'gols' + linha,
            mercado: 'Total de Gols',
            selecao: venc.selecao,
            probabilidade: venc.p,
            condicao: venc.cond,
            ctx: ctx,
            justificativa:
              'O modelo espera ' + fmt(total) + ' gols na partida (' + fmt(ctx.lambdaCasa) +
              ' do mandante + ' + fmt(ctx.lambdaFora) + ' do visitante).',
          })
        );
      });

      /* ambas marcam */
      var condAmbas = function (i, j) {
        return i > 0 && j > 0;
      };
      var pAmbas = somar(ctx.matriz, condAmbas);

      var ambas =
        pAmbas >= 0.5
          ? { selecao: 'Ambas Marcam: Sim', p: pAmbas, cond: condAmbas }
          : {
              selecao: 'Ambas Marcam: Não',
              p: 1 - pAmbas,
              cond: function (i, j) {
                return i === 0 || j === 0;
              },
            };

      lista.push(
        criar({
          familia: 'ambas',
          mercado: 'Ambas Marcam',
          selecao: ambas.selecao,
          probabilidade: ambas.p,
          condicao: ambas.cond,
          ctx: ctx,
          justificativa:
            nomeCasa + ' sofreu ' + fmt(ctx.formaCasa.mediaContra) + ' gol(s) por jogo; ' + nomeFora +
            ' sofreu ' + fmt(ctx.formaFora.mediaContra) + '.',
        })
      );

      /* handicap asiatico no favorito */
      var favCasa = p.casa >= p.fora;
      var condHcap = favCasa
        ? function (i, j) {
            return i - j >= 2;
          }
        : function (i, j) {
            return j - i >= 2;
          };

      lista.push(
        criar({
          familia: 'handicap',
          mercado: 'Handicap Asiático',
          selecao: (favCasa ? nomeCasa : nomeFora) + ' -1.5',
          probabilidade: somar(ctx.matriz, condHcap),
          condicao: condHcap,
          ctx: ctx,
          justificativa: 'Exige vitória por 2 gols ou mais, por isso paga bem melhor.',
        })
      );

      /* time marca — perna barata e util para combinar */
      [
        {
          nome: nomeCasa,
          sel: nomeCasa + ' marca',
          cond: function (i) {
            return i > 0;
          },
        },
        {
          nome: nomeFora,
          sel: nomeFora + ' marca',
          cond: function (i, j) {
            return j > 0;
          },
        },
      ].forEach(function (t, idx) {
        lista.push(
          criar({
            familia: 'marca' + idx,
            mercado: 'Equipe Marca',
            selecao: t.sel,
            probabilidade: somar(ctx.matriz, t.cond),
            condicao: t.cond,
            ctx: ctx,
            justificativa: 'Chance de o ' + t.nome + ' balançar a rede ao menos uma vez.',
          })
        );
      });
    }

    /* Corta o que nao alcanca a confianca minima do config. */
    return lista.filter(function (m) {
      return m.confianca >= M.confiancaMinima;
    });
  }

  function criar(o) {
    var probabilidade = o.probabilidade;
    var prob100 = limitar(probabilidade * 100, 0, 100);

    /* AQUI e onde a honestidade entra: a confianca mostrada nao e a
       probabilidade crua. Ela e puxada na direcao do meio conforme a
       amostra disponivel, e cortada no teto do config. */
    var confianca = 50 + (prob100 - 50) * o.ctx.amostra;
    confianca = limitar(confianca, 0, M.confiancaMaxima);

    return {
      familia: o.familia,
      mercado: o.mercado,
      selecao: o.selecao,
      probabilidade: prob100,
      confianca: Math.round(confianca * 10) / 10,
      oddJusta: probabilidade > 0.001 ? arredondarOdd(1 / probabilidade) : null,
      condicao: o.condicao || null,
      justificativa: o.justificativa || '',
      nivel: nivelDeConfianca(confianca),
      tipo: 'simples',
    };
  }

  function arredondarOdd(o) {
    return Math.round(o * 100) / 100;
  }

  /* ================================================================
     COMBINACOES  ("Criar Aposta")

     A graca aqui e que a odd combinada NAO e a multiplicacao das odds.
     "Vitoria do mandante" e "mais de 2.5 gols" sao eventos ligados: um
     time que vence costuma marcar mais. Multiplicar as odds trataria os
     dois como independentes e daria um numero errado (otimista demais).

     Como a matriz de placares ja tem a probabilidade de cada resultado
     possivel, da para somar exatamente as celulas onde AS DUAS condicoes
     acontecem juntas. A odd sai dessa probabilidade conjunta — e fica
     certa, inclusive a correlacao.
     ================================================================ */

  function montarCombos(mercados, matriz, amostra) {
    var comCondicao = mercados.filter(function (m) {
      return typeof m.condicao === 'function';
    });

    var combos = [];

    for (var a = 0; a < comCondicao.length; a++) {
      for (var b = a + 1; b < comCondicao.length; b++) {
        var m1 = comCondicao[a];
        var m2 = comCondicao[b];

        /* Dois mercados da mesma familia sao a mesma aposta. */
        if (familiaBase(m1.familia) === familiaBase(m2.familia)) continue;

        var combo = combinar([m1, m2], matriz, amostra);
        if (combo) combos.push(combo);
      }
    }

    /* Tenta tambem trincas, partindo das duplas que ficaram baratas. */
    if (A.maxPernasCombo >= 3) {
      var duplasBaratas = combos
        .filter(function (c) {
          return c.odd < A.comboOddMinima * 1.3;
        })
        .slice(0, 6);

      duplasBaratas.forEach(function (dupla) {
        comCondicao.forEach(function (m3) {
          var repetida = dupla.pernas.some(function (p) {
            return familiaBase(p.familia) === familiaBase(m3.familia);
          });
          if (repetida) return;

          var trinca = combinar(dupla.pernas.concat([m3]), matriz, amostra);
          if (trinca) combos.push(trinca);
        });
      });
    }

    /* Mantem so o que cai na faixa de odd pedida no config. */
    combos = combos.filter(function (c) {
      return c.odd >= A.comboOddMinima && c.odd <= A.comboOddMaxima;
    });

    combos.sort(function (x, y) {
      return y.confianca - x.confianca;
    });

    return desduplicar(combos).slice(0, A.combosPorJogo);
  }

  /** "gols2.5" e "gols1.5" contam como a mesma familia: gols. */
  function familiaBase(f) {
    return String(f || '').replace(/[0-9.]+$/, '');
  }

  function combinar(pernas, matriz, amostra) {
    var conjunta = somar(matriz, function (i, j) {
      for (var k = 0; k < pernas.length; k++) {
        if (!pernas[k].condicao(i, j)) return false;
      }
      return true;
    });

    if (conjunta <= 0.02) return null;

    /* Se combinar nao mudou quase nada a probabilidade, uma perna ja
       estava contida na outra (ex: "handicap -1.5" ja implica "vitoria").
       Isso nao e uma aposta combinada, e a mesma aposta escrita duas
       vezes — a casa nem aceitaria. */
    var menor = Math.min.apply(
      null,
      pernas.map(function (p) {
        return p.probabilidade / 100;
      })
    );
    if (Math.abs(conjunta - menor) < 0.005) return null;

    /* Mesma ideia, mas perna a perna: se tirar uma selecao nao muda a
       probabilidade conjunta, aquela selecao nao esta fazendo nada.
       Ex: "Flamengo vence" + "Flamengo marca" — vencer ja obriga marcar.
       A casa nao paga nada a mais por isso, entao nao sugerimos. */
    if (pernas.length > 1) {
      for (var p = 0; p < pernas.length; p++) {
        var semEssa = pernas.filter(function (_, i) {
          return i !== p;
        });
        var semPerna = somar(matriz, function (i, j) {
          for (var k = 0; k < semEssa.length; k++) {
            if (!semEssa[k].condicao(i, j)) return false;
          }
          return true;
        });
        if (Math.abs(conjunta - semPerna) < 0.005) return null;
      }
    }

    var prob100 = conjunta * 100;
    var confianca = limitar(50 + (prob100 - 50) * amostra, 0, M.confiancaMaxima);

    return {
      tipo: 'combo',
      pernas: pernas,
      probabilidade: prob100,
      confianca: Math.round(confianca * 10) / 10,
      odd: arredondarOdd(1 / conjunta),
      nivel: nivelDeConfianca(confianca),
      justificativa:
        'Probabilidade conjunta calculada na matriz de placares, já considerando a ' +
        'correlação entre as seleções.',
    };
  }

  function desduplicar(combos) {
    var vistos = {};
    return combos.filter(function (c) {
      var assinatura = c.pernas
        .map(function (p) {
          return p.familia;
        })
        .sort()
        .join('+');
      if (vistos[assinatura]) return false;
      vistos[assinatura] = true;
      return true;
    });
  }

  function nivelDeConfianca(c) {
    if (c >= 78) return { rotulo: 'Alta', classe: 'alta' };
    if (c >= 65) return { rotulo: 'Média', classe: 'media' };
    return { rotulo: 'Baixa', classe: 'baixa' };
  }

  function justificarResultado(escolha, ctx) {
    var partes = [];

    var fc = ctx.formaCasa;
    var ff = ctx.formaFora;

    if (fc.quantidade) {
      partes.push(
        ctx.casa.nome + ' somou ' + fc.pontos + ' de ' + fc.quantidade * 3 +
          ' pontos nos últimos ' + fc.quantidade + ' jogos'
      );
    }
    if (ff.quantidade) {
      partes.push(
        ctx.fora.nome + ' somou ' + ff.pontos + ' de ' + ff.quantidade * 3 + ' no mesmo recorte'
      );
    }
    if (ctx.h2h.quantidade) {
      partes.push(
        'nos ' + ctx.h2h.quantidade + ' confrontos diretos foram ' + ctx.h2h.vitoriasCasa + 'V-' +
          ctx.h2h.empates + 'E-' + ctx.h2h.vitoriasFora + 'D para o ' + ctx.casa.nome
      );
    }

    if (!partes.length) return 'Amostra muito pequena: o modelo trabalhou quase no escuro.';
    return partes.join('; ') + '.';
  }

  function fmt(n) {
    return (Math.round(n * 100) / 100).toString().replace('.', ',');
  }

  /* ================================================================ */

  global.Modelo = {
    analisar: analisar,
    forma: forma,
    mediasGols: mediasGols,
    resumoConfrontos: resumoConfrontos,
    matrizPlacar: matrizPlacar,
    montarCombos: montarCombos,
    combinar: combinar,
    poisson: poisson,
    perspectiva: perspectiva,
    nivelDeConfianca: nivelDeConfianca,
  };
})(window);
