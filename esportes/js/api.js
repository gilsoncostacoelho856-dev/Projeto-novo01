/* =====================================================================
   CAMADA DA API  —  TheSportsDB

   Responsabilidades deste arquivo:
     - montar as URLs (e so ele conhece a chave, que vem do config.js);
     - segurar o ritmo das chamadas para nao estourar o limite gratuito;
     - cancelar o que demora demais e tentar de novo quando da erro;
     - devolver dados JA NORMALIZADOS, porque a TheSportsDB mudou nomes
       de campos ao longo do tempo (strTeamBadge virou strBadge, etc.)
       e o resto do site nao deveria precisar saber disso.

   Toda funcao publica devolve:
       { dados: <...>, origem: 'rede' | 'cache' | 'cache-vencido', aviso? }
   Nunca devolve `undefined`. Lista vazia e lista vazia, nao erro.
   ===================================================================== */

(function (global) {
  'use strict';

  var C = global.CONFIG;
  var Cache = global.Cache;

  /* ================================================================
     ERRO
     ================================================================ */

  function ErroApi(mensagem, tipo, status) {
    this.name = 'ErroApi';
    this.message = mensagem;
    this.tipo = tipo || 'desconhecido'; // rede | tempo | http | formato | premium
    this.status = status || 0;
  }
  ErroApi.prototype = Object.create(Error.prototype);

  function mensagemAmigavel(erro) {
    if (!erro) return 'Nao foi possivel carregar os dados.';
    switch (erro.tipo) {
      case 'tempo':
        return 'A API demorou demais para responder. Tente de novo em instantes.';
      case 'rede':
        return 'Sem conexao com a API de dados. Verifique sua internet.';
      case 'premium':
        return 'Este dado so esta disponivel no plano pago da TheSportsDB.';
      case 'limite':
        return 'Limite de requisicoes da chave gratuita atingido. Aguarde um minuto.';
      case 'http':
        return 'A API respondeu com erro ' + erro.status + '.';
      case 'formato':
        return 'A API respondeu em um formato inesperado.';
      default:
        return erro.message || 'Nao foi possivel carregar os dados.';
    }
  }

  /* ================================================================
     FILA  —  segura o ritmo das chamadas
     Sem isto, abrir a pagina de apostas dispara 30 chamadas de uma vez
     e a chave gratuita bloqueia.
     ================================================================ */

  var fila = [];
  var ativas = 0;
  var ultimoDisparo = 0;

  function enfileirar(tarefa) {
    return new Promise(function (resolve, reject) {
      fila.push({ tarefa: tarefa, resolve: resolve, reject: reject });
      bombear();
    });
  }

  function bombear() {
    if (!fila.length) return;
    if (ativas >= C.api.maxSimultaneas) return;

    var espera = C.api.intervaloMinimoMs - (Date.now() - ultimoDisparo);
    if (espera > 0) {
      setTimeout(bombear, espera);
      return;
    }

    var item = fila.shift();
    ativas++;
    ultimoDisparo = Date.now();

    item
      .tarefa()
      .then(item.resolve, item.reject)
      .then(function () {
        ativas--;
        bombear();
      });

    /* Pode haver folga para disparar outra em paralelo. */
    if (ativas < C.api.maxSimultaneas) setTimeout(bombear, C.api.intervaloMinimoMs);
  }

  /* ================================================================
     URL
     ================================================================ */

  function querystring(params) {
    if (!params) return '';
    var partes = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (v === null || v === undefined || v === '') return;
      partes.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return partes.length ? '?' + partes.join('&') : '';
  }

  function urlV1(recurso, params) {
    var alvo = C.api.baseV1 + '/' + encodeURIComponent(C.api.chave) + '/' + recurso + querystring(params);
    return C.proxy.ativo ? C.proxy.url + '?alvo=' + encodeURIComponent(alvo) : alvo;
  }

  function urlV2(caminho) {
    var alvo = C.api.baseV2 + '/' + caminho;
    return C.proxy.ativo ? C.proxy.url + '?alvo=' + encodeURIComponent(alvo) : alvo;
  }

  /* ================================================================
     BUSCA CRUA  —  fetch com timeout e tentativa extra
     ================================================================ */

  function buscarCru(url, cabecalhos) {
    return enfileirar(function () {
      return tentar(0);
    });

    function tentar(n) {
      var controle = new AbortController();
      var estourou = false;
      var relogio = setTimeout(function () {
        estourou = true;
        controle.abort();
      }, C.api.timeoutMs);

      return fetch(url, {
        signal: controle.signal,
        headers: cabecalhos || {},
        cache: 'no-store',
      })
        .then(function (resposta) {
          clearTimeout(relogio);

          if (resposta.status === 429) {
            throw new ErroApi('Limite de requisicoes atingido.', 'limite', 429);
          }
          if (resposta.status === 401 || resposta.status === 403) {
            throw new ErroApi('Recurso restrito ao plano pago.', 'premium', resposta.status);
          }
          if (!resposta.ok) {
            throw new ErroApi('Resposta HTTP ' + resposta.status, 'http', resposta.status);
          }

          return resposta.text().then(function (texto) {
            /* A TheSportsDB as vezes devolve corpo vazio no lugar de um
               JSON com listas nulas. Trata como "sem dados", nao erro. */
            if (!texto || !texto.trim()) return {};
            try {
              return JSON.parse(texto);
            } catch (e) {
              throw new ErroApi('JSON invalido vindo da API.', 'formato', 0);
            }
          });
        })
        .catch(function (erro) {
          clearTimeout(relogio);

          if (erro instanceof ErroApi) {
            /* Erro de conteudo nao melhora tentando de novo. */
            if (erro.tipo === 'premium' || erro.tipo === 'formato') throw erro;
          }

          var convertido =
            erro instanceof ErroApi
              ? erro
              : estourou
                ? new ErroApi('Tempo esgotado.', 'tempo', 0)
                : new ErroApi(erro.message || 'Falha de rede.', 'rede', 0);

          if (n + 1 < C.api.tentativas) {
            var recuo = 400 * Math.pow(2, n);
            return new Promise(function (r) {
              setTimeout(r, recuo);
            }).then(function () {
              return tentar(n + 1);
            });
          }
          throw convertido;
        });
    }
  }

  /* ================================================================
     BUSCA COM CACHE
     Se a rede falhar mas existir copia antiga, devolve a copia antiga
     marcada como 'cache-vencido' — a tela avisa o usuario.
     ================================================================ */

  function buscar(chaveCache, url, ttlMs, cabecalhos) {
    var guardado = Cache.ler(chaveCache);

    if (guardado && !guardado.vencido) {
      return Promise.resolve({ dados: guardado.dados, origem: 'cache' });
    }

    return buscarCru(url, cabecalhos)
      .then(function (json) {
        Cache.gravar(chaveCache, json, ttlMs);
        return { dados: json, origem: 'rede' };
      })
      .catch(function (erro) {
        if (guardado) {
          return {
            dados: guardado.dados,
            origem: 'cache-vencido',
            aviso: mensagemAmigavel(erro) + ' Mostrando dados salvos.',
            erro: erro,
          };
        }
        throw erro;
      });
  }

  /* ================================================================
     NORMALIZACAO
     A API foi renomeando campos. Aqui a gente aceita os dois nomes e
     o resto do site trabalha com um formato so.
     ================================================================ */

  function primeiro(obj) {
    for (var i = 1; i < arguments.length; i++) {
      var v = obj ? obj[arguments[i]] : null;
      if (v !== null && v !== undefined && v !== '') return v;
    }
    return '';
  }

  function inteiroOuNulo(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }

  function lista(json, chave) {
    if (!json) return [];
    var v = json[chave];
    return Array.isArray(v) ? v : [];
  }

  function normalizarEvento(e) {
    if (!e) return null;

    var placarCasa = inteiroOuNulo(primeiro(e, 'intHomeScore'));
    var placarFora = inteiroOuNulo(primeiro(e, 'intAwayScore'));

    /* Monta o horario. `strTimestamp` ja vem em UTC quando existe;
       senao junta dateEvent + strTime, que tambem sao UTC. */
    var quando = null;
    var ts = primeiro(e, 'strTimestamp');
    if (ts) {
      quando = new Date(ts.indexOf('Z') >= 0 || ts.indexOf('+') > 0 ? ts : ts.replace(' ', 'T') + 'Z');
    } else {
      var d = primeiro(e, 'dateEvent', 'dateEventLocal');
      var h = primeiro(e, 'strTime', 'strTimeLocal');
      if (d) quando = new Date(d + 'T' + (h || '00:00:00').slice(0, 8) + 'Z');
    }
    if (quando && isNaN(quando.getTime())) quando = null;

    var status = String(primeiro(e, 'strStatus') || '').trim();
    var adiado = String(primeiro(e, 'strPostponed') || '').toLowerCase() === 'yes';

    return {
      id: String(primeiro(e, 'idEvent')),
      nome: primeiro(e, 'strEvent', 'strEventAlternate'),
      esporte: primeiro(e, 'strSport'),
      liga: primeiro(e, 'strLeague'),
      idLiga: String(primeiro(e, 'idLeague') || ''),
      temporada: primeiro(e, 'strSeason'),
      rodada: inteiroOuNulo(primeiro(e, 'intRound')),

      casa: {
        id: String(primeiro(e, 'idHomeTeam') || ''),
        nome: primeiro(e, 'strHomeTeam'),
        escudo: primeiro(e, 'strHomeTeamBadge', 'strHomeTeamLogo'),
      },
      fora: {
        id: String(primeiro(e, 'idAwayTeam') || ''),
        nome: primeiro(e, 'strAwayTeam'),
        escudo: primeiro(e, 'strAwayTeamBadge', 'strAwayTeamLogo'),
      },

      placarCasa: placarCasa,
      placarFora: placarFora,
      temPlacar: placarCasa !== null && placarFora !== null,

      quando: quando,
      dataISO: primeiro(e, 'dateEvent'),
      status: status,
      adiado: adiado,
      aoVivo: ehAoVivo(status, quando, placarCasa),
      encerrado: ehEncerrado(status, quando, placarCasa),

      local: primeiro(e, 'strVenue'),
      pais: primeiro(e, 'strCountry'),
      imagem: primeiro(e, 'strThumb', 'strBanner', 'strPoster'),
      transmissao: primeiro(e, 'strTVStation'),
    };
  }

  /* A API nao tem um campo confiavel de "esta rolando agora", entao a
     gente combina status + horario + placar. */
  function ehAoVivo(status, quando, placarCasa) {
    var s = String(status || '').toUpperCase();
    if (!s) {
      /* sem status: considera ao vivo se comecou ha menos de 2h30 e ja
         tem placar na mao */
      if (!quando || placarCasa === null) return false;
      var decorrido = Date.now() - quando.getTime();
      return decorrido > 0 && decorrido < 2.5 * 3600 * 1000;
    }
    if (s === 'NS' || s === 'FT' || s === 'AET' || s === 'PEN' || s === 'POSTP' || s === 'CANC') return false;
    if (s === 'MATCH FINISHED' || s === 'FINISHED' || s === 'NOT STARTED') return false;
    /* 1H, 2H, HT, ET, "45", "67" ... tudo isso e jogo rolando */
    return true;
  }

  function ehEncerrado(status, quando, placarCasa) {
    var s = String(status || '').toUpperCase();
    if (s === 'FT' || s === 'AET' || s === 'PEN' || s === 'MATCH FINISHED' || s === 'FINISHED') return true;
    if (placarCasa !== null && quando && Date.now() - quando.getTime() > 3.5 * 3600 * 1000) return true;
    return false;
  }

  function normalizarTime(t) {
    if (!t) return null;
    return {
      id: String(primeiro(t, 'idTeam')),
      nome: primeiro(t, 'strTeam'),
      apelido: primeiro(t, 'strTeamShort', 'strAlternate'),
      esporte: primeiro(t, 'strSport'),
      liga: primeiro(t, 'strLeague'),
      idLiga: String(primeiro(t, 'idLeague') || ''),
      pais: primeiro(t, 'strCountry'),
      fundacao: primeiro(t, 'intFormedYear'),
      estadio: primeiro(t, 'strStadium'),
      capacidade: inteiroOuNulo(primeiro(t, 'intStadiumCapacity')),
      localizacao: primeiro(t, 'strLocation', 'strStadiumLocation'),
      escudo: primeiro(t, 'strBadge', 'strTeamBadge'),
      logo: primeiro(t, 'strLogo', 'strTeamLogo'),
      banner: primeiro(t, 'strBanner', 'strTeamBanner', 'strFanart1', 'strTeamFanart1'),
      camisa: primeiro(t, 'strEquipment', 'strTeamJersey'),
      site: primeiro(t, 'strWebsite'),
      descricao: primeiro(t, 'strDescriptionPT', 'strDescriptionES', 'strDescriptionEN'),
    };
  }

  function normalizarJogador(p) {
    if (!p) return null;
    return {
      id: String(primeiro(p, 'idPlayer')),
      nome: primeiro(p, 'strPlayer'),
      idTime: String(primeiro(p, 'idTeam') || ''),
      time: primeiro(p, 'strTeam'),
      esporte: primeiro(p, 'strSport'),
      posicao: primeiro(p, 'strPosition'),
      numero: primeiro(p, 'strNumber'),
      nascimento: primeiro(p, 'dateBorn'),
      naturalidade: primeiro(p, 'strBirthLocation'),
      nacionalidade: primeiro(p, 'strNationality'),
      altura: primeiro(p, 'strHeight'),
      peso: primeiro(p, 'strWeight'),
      assinatura: primeiro(p, 'strSigning'),
      salario: primeiro(p, 'strWage'),
      status: primeiro(p, 'strStatus'),
      genero: primeiro(p, 'strGender'),
      lado: primeiro(p, 'strSide'),
      foto: primeiro(p, 'strCutout', 'strThumb', 'strRender'),
      capa: primeiro(p, 'strFanart1', 'strBanner'),
      descricao: primeiro(p, 'strDescriptionPT', 'strDescriptionES', 'strDescriptionEN'),
    };
  }

  function normalizarLiga(l) {
    if (!l) return null;
    return {
      id: String(primeiro(l, 'idLeague')),
      nome: primeiro(l, 'strLeague'),
      alternativo: primeiro(l, 'strLeagueAlternate'),
      esporte: primeiro(l, 'strSport'),
      pais: primeiro(l, 'strCountry'),
      escudo: primeiro(l, 'strBadge', 'strLogo'),
      temporadaAtual: primeiro(l, 'strCurrentSeason'),
    };
  }

  function mapear(arr, fn) {
    return (arr || [])
      .map(fn)
      .filter(function (x) {
        return !!x;
      });
  }

  /* ================================================================
     FUNCOES PUBLICAS
     ================================================================ */

  /* -------------------------------------------------------- ligas ---- */

  function ligas(esporte) {
    var chave = 'ligas:' + (esporte || 'todas');
    var url = esporte
      ? urlV1('search_all_leagues.php', { s: esporte })
      : urlV1('all_leagues.php');

    return buscar(chave, url, C.cache.ttlEstaticoMs).then(function (r) {
      /* search_all_leagues devolve a lista em "countries";
         all_leagues devolve em "leagues". Aceita as duas. */
      var cru = lista(r.dados, 'countries');
      if (!cru.length) cru = lista(r.dados, 'leagues');

      var itens = mapear(cru, normalizarLiga).filter(function (l) {
        return l.nome && (!esporte || !l.esporte || l.esporte === esporte);
      });

      itens.sort(function (a, b) {
        return a.nome.localeCompare(b.nome);
      });

      return { dados: itens, origem: r.origem, aviso: r.aviso };
    });
  }

  /**
   * Acha o id de uma liga pelo nome, sem depender de numero fixo.
   * Tenta nome exato, depois "comeca com", depois "contem".
   */
  function acharLiga(listaLigas, nome) {
    if (!nome) return null;
    var alvo = nome.toLowerCase().trim();

    var exato = listaLigas.filter(function (l) {
      return l.nome.toLowerCase() === alvo || String(l.alternativo || '').toLowerCase() === alvo;
    });
    if (exato.length) return exato[0];

    var comeca = listaLigas.filter(function (l) {
      return l.nome.toLowerCase().indexOf(alvo) === 0;
    });
    if (comeca.length) return comeca[0];

    var contem = listaLigas.filter(function (l) {
      return l.nome.toLowerCase().indexOf(alvo) >= 0;
    });
    return contem.length ? contem[0] : null;
  }

  /* -------------------------------------------------------- jogos ---- */

  /** Jogos de um dia (YYYY-MM-DD), opcionalmente filtrados por esporte. */
  function jogosDoDia(dataISO, esporte) {
    var chave = 'dia:' + dataISO + ':' + (esporte || 'todos');
    var url = urlV1('eventsday.php', {
      d: dataISO,
      s: esporte ? esporte.replace(/ /g, '_') : null,
    });

    return buscar(chave, url, C.cache.ttlPadraoMs).then(function (r) {
      return { dados: mapear(lista(r.dados, 'events'), normalizarEvento), origem: r.origem, aviso: r.aviso };
    });
  }

  /** Proximos jogos de uma liga (a API devolve ate 15). */
  function proximosDaLiga(idLiga) {
    var chave = 'proxliga:' + idLiga;
    return buscar(chave, urlV1('eventsnextleague.php', { id: idLiga }), C.cache.ttlPadraoMs).then(function (r) {
      return { dados: mapear(lista(r.dados, 'events'), normalizarEvento), origem: r.origem, aviso: r.aviso };
    });
  }

  /** Ultimos jogos de uma liga (a API devolve ate 15). */
  function ultimosDaLiga(idLiga) {
    var chave = 'ultliga:' + idLiga;
    return buscar(chave, urlV1('eventspastleague.php', { id: idLiga }), C.cache.ttlPadraoMs).then(function (r) {
      return { dados: mapear(lista(r.dados, 'events'), normalizarEvento), origem: r.origem, aviso: r.aviso };
    });
  }

  /**
   * Placar ao vivo.
   * Com a chave gratuita isso normalmente volta vazio — quem chama
   * recebe `premium: true` e mostra o aviso na tela em vez de erro.
   */
  function jogosAoVivo(esporte) {
    var chave = 'aovivo:' + (esporte || 'todos') + ':' + (C.api.usarV2AoVivo ? 'v2' : 'v1');

    var url, cabecalhos;
    if (C.api.usarV2AoVivo) {
      url = urlV2('livescore/' + encodeURIComponent((esporte || 'soccer').toLowerCase().replace(/ /g, '_')));
      cabecalhos = { 'X-API-KEY': C.api.chave };
    } else {
      url = urlV1('livescore.php', { s: esporte ? esporte.replace(/ /g, '_') : null });
      cabecalhos = null;
    }

    return buscar(chave, url, C.cache.ttlAoVivoMs, cabecalhos)
      .then(function (r) {
        var cru = lista(r.dados, 'events');
        if (!cru.length) cru = lista(r.dados, 'livescore');

        return {
          dados: mapear(cru, normalizarEvento),
          origem: r.origem,
          aviso: r.aviso,
          premium: !cru.length && !C.api.usarV2AoVivo,
        };
      })
      .catch(function (erro) {
        /* Ao vivo negado nao pode derrubar a home inteira. */
        if (erro.tipo === 'premium' || erro.tipo === 'http') {
          return { dados: [], origem: 'rede', premium: true, erro: erro };
        }
        throw erro;
      });
  }

  function evento(idEvento) {
    return buscar('evento:' + idEvento, urlV1('lookupevent.php', { id: idEvento }), C.cache.ttlPadraoMs).then(
      function (r) {
        var itens = mapear(lista(r.dados, 'events'), normalizarEvento);
        return { dados: itens[0] || null, origem: r.origem, aviso: r.aviso };
      }
    );
  }

  /* -------------------------------------------------------- times ---- */

  function time(idTime) {
    return buscar('time:' + idTime, urlV1('lookupteam.php', { id: idTime }), C.cache.ttlEstaticoMs).then(function (r) {
      var itens = mapear(lista(r.dados, 'teams'), normalizarTime);
      return { dados: itens[0] || null, origem: r.origem, aviso: r.aviso };
    });
  }

  function buscarTimes(nome) {
    return buscar('buscatime:' + nome, urlV1('searchteams.php', { t: nome }), C.cache.ttlEstaticoMs).then(function (r) {
      return { dados: mapear(lista(r.dados, 'teams'), normalizarTime), origem: r.origem, aviso: r.aviso };
    });
  }

  function timesDaLiga(idLiga) {
    return buscar('timesliga:' + idLiga, urlV1('lookup_all_teams.php', { id: idLiga }), C.cache.ttlEstaticoMs).then(
      function (r) {
        return { dados: mapear(lista(r.dados, 'teams'), normalizarTime), origem: r.origem, aviso: r.aviso };
      }
    );
  }

  /** Ultimos 5 jogos do time. Repare: a API devolve em "results". */
  function ultimosDoTime(idTime) {
    return buscar('ulttime:' + idTime, urlV1('eventslast.php', { id: idTime }), C.cache.ttlPadraoMs).then(function (r) {
      var cru = lista(r.dados, 'results');
      if (!cru.length) cru = lista(r.dados, 'events');
      return { dados: mapear(cru, normalizarEvento), origem: r.origem, aviso: r.aviso };
    });
  }

  function proximosDoTime(idTime) {
    return buscar('proxtime:' + idTime, urlV1('eventsnext.php', { id: idTime }), C.cache.ttlPadraoMs).then(function (r) {
      return { dados: mapear(lista(r.dados, 'events'), normalizarEvento), origem: r.origem, aviso: r.aviso };
    });
  }

  /* ----------------------------------------------------- jogadores ---- */

  /**
   * Elenco. `lookup_all_players` e o caminho bom, mas em varias contas
   * gratuitas ele responde vazio. Quando isso acontece a gente cai para
   * `searchplayers`, que aceita o nome do time.
   */
  function elenco(idTime, nomeTime) {
    return buscar('elenco:' + idTime, urlV1('lookup_all_players.php', { id: idTime }), C.cache.ttlEstaticoMs)
      .then(function (r) {
        var itens = mapear(lista(r.dados, 'player'), normalizarJogador);
        if (itens.length || !nomeTime) {
          return { dados: itens, origem: r.origem, aviso: r.aviso, premium: !itens.length };
        }
        return elencoPorNome(nomeTime);
      })
      .catch(function (erro) {
        if (nomeTime && (erro.tipo === 'premium' || erro.tipo === 'http')) return elencoPorNome(nomeTime);
        throw erro;
      });
  }

  function elencoPorNome(nomeTime) {
    return buscar('elencoNome:' + nomeTime, urlV1('searchplayers.php', { t: nomeTime }), C.cache.ttlEstaticoMs)
      .then(function (r) {
        var itens = mapear(lista(r.dados, 'player'), normalizarJogador);
        return { dados: itens, origem: r.origem, aviso: r.aviso, premium: !itens.length };
      })
      .catch(function () {
        return { dados: [], origem: 'rede', premium: true };
      });
  }

  function jogador(idJogador) {
    return buscar('jogador:' + idJogador, urlV1('lookupplayer.php', { id: idJogador }), C.cache.ttlEstaticoMs).then(
      function (r) {
        var itens = mapear(lista(r.dados, 'players'), normalizarJogador);
        if (!itens.length) itens = mapear(lista(r.dados, 'player'), normalizarJogador);
        return { dados: itens[0] || null, origem: r.origem, aviso: r.aviso };
      }
    );
  }

  function buscarJogadores(nome) {
    return buscar('buscajogador:' + nome, urlV1('searchplayers.php', { p: nome }), C.cache.ttlEstaticoMs).then(
      function (r) {
        return { dados: mapear(lista(r.dados, 'player'), normalizarJogador), origem: r.origem, aviso: r.aviso };
      }
    );
  }

  /** Contratos / honrarias do jogador — costuma ser premium. */
  function contratosDoJogador(idJogador) {
    return buscar('contratos:' + idJogador, urlV1('lookupcontracts.php', { id: idJogador }), C.cache.ttlEstaticoMs)
      .then(function (r) {
        return { dados: lista(r.dados, 'contracts'), origem: r.origem };
      })
      .catch(function () {
        return { dados: [], origem: 'rede', premium: true };
      });
  }

  /* ---------------------------------------------------- confrontos ---- */

  /**
   * Historico de confrontos diretos.
   * A TheSportsDB aceita `searchevents.php?e=Time_A_vs_Time_B`. A ordem
   * dos nomes importa, entao consulta os dois sentidos e junta.
   * Se nada voltar, cai para o cruzamento dos ultimos jogos de cada time
   * — menos completo, mas melhor que tela vazia.
   */
  function confrontos(nomeCasa, nomeFora, idCasa, idFora) {
    var a = slugTime(nomeCasa);
    var b = slugTime(nomeFora);

    var ida = buscarConfronto(a + '_vs_' + b);
    var volta = buscarConfronto(b + '_vs_' + a);

    return Promise.all([ida, volta]).then(function (res) {
      var juntos = res[0].concat(res[1]);
      var vistos = {};
      var unicos = [];

      juntos.forEach(function (ev) {
        if (!ev || vistos[ev.id]) return;
        /* Confere que o jogo e mesmo entre os dois times pedidos. */
        var nomes = (ev.casa.nome + '|' + ev.fora.nome).toLowerCase();
        if (nomes.indexOf(nomeCasa.toLowerCase()) < 0 || nomes.indexOf(nomeFora.toLowerCase()) < 0) return;
        vistos[ev.id] = true;
        unicos.push(ev);
      });

      unicos.sort(function (x, y) {
        return (y.quando ? y.quando.getTime() : 0) - (x.quando ? x.quando.getTime() : 0);
      });

      if (unicos.length) {
        return { dados: unicos.slice(0, C.modelo.janelaConfrontos), origem: 'rede', metodo: 'busca' };
      }

      /* Plano B: procura os dois times dentro dos ultimos jogos deles. */
      if (!idCasa || !idFora) return { dados: [], origem: 'rede', metodo: 'nenhum' };

      return Promise.all([ultimosDoTime(idCasa), ultimosDoTime(idFora)]).then(function (dois) {
        var todos = dois[0].dados.concat(dois[1].dados);
        var marcados = {};
        var cruzados = [];

        todos.forEach(function (ev) {
          if (marcados[ev.id]) return;
          var n = (ev.casa.nome + '|' + ev.fora.nome).toLowerCase();
          if (n.indexOf(nomeCasa.toLowerCase()) >= 0 && n.indexOf(nomeFora.toLowerCase()) >= 0) {
            marcados[ev.id] = true;
            cruzados.push(ev);
          }
        });

        return { dados: cruzados, origem: 'rede', metodo: cruzados.length ? 'cruzamento' : 'nenhum' };
      });
    });
  }

  function buscarConfronto(termo) {
    return buscar('h2h:' + termo, urlV1('searchevents.php', { e: termo }), C.cache.ttlEstaticoMs)
      .then(function (r) {
        return mapear(lista(r.dados, 'event'), normalizarEvento).concat(
          mapear(lista(r.dados, 'events'), normalizarEvento)
        );
      })
      .catch(function () {
        return [];
      });
  }

  function slugTime(nome) {
    return String(nome || '').trim().replace(/\s+/g, '_');
  }

  /* ------------------------------------------------------- tabela ---- */

  function tabela(idLiga, temporada) {
    var chave = 'tabela:' + idLiga + ':' + (temporada || 'atual');
    return buscar(chave, urlV1('lookuptable.php', { l: idLiga, s: temporada }), C.cache.ttlPadraoMs)
      .then(function (r) {
        var cru = lista(r.dados, 'table');
        return {
          dados: cru.map(function (t) {
            return {
              posicao: inteiroOuNulo(primeiro(t, 'intRank')),
              idTime: String(primeiro(t, 'idTeam') || ''),
              time: primeiro(t, 'strTeam'),
              escudo: primeiro(t, 'strBadge', 'strTeamBadge'),
              jogos: inteiroOuNulo(primeiro(t, 'intPlayed')),
              vitorias: inteiroOuNulo(primeiro(t, 'intWin')),
              empates: inteiroOuNulo(primeiro(t, 'intDraw')),
              derrotas: inteiroOuNulo(primeiro(t, 'intLoss')),
              golsPro: inteiroOuNulo(primeiro(t, 'intGoalsFor')),
              golsContra: inteiroOuNulo(primeiro(t, 'intGoalsAgainst')),
              saldo: inteiroOuNulo(primeiro(t, 'intGoalDifference')),
              pontos: inteiroOuNulo(primeiro(t, 'intPoints')),
            };
          }),
          origem: r.origem,
          aviso: r.aviso,
        };
      })
      .catch(function () {
        return { dados: [], origem: 'rede', premium: true };
      });
  }

  /* ================================================================ */

  global.Api = {
    ErroApi: ErroApi,
    mensagemAmigavel: mensagemAmigavel,

    ligas: ligas,
    acharLiga: acharLiga,

    jogosDoDia: jogosDoDia,
    jogosAoVivo: jogosAoVivo,
    proximosDaLiga: proximosDaLiga,
    ultimosDaLiga: ultimosDaLiga,
    evento: evento,

    time: time,
    buscarTimes: buscarTimes,
    timesDaLiga: timesDaLiga,
    ultimosDoTime: ultimosDoTime,
    proximosDoTime: proximosDoTime,

    elenco: elenco,
    jogador: jogador,
    buscarJogadores: buscarJogadores,
    contratosDoJogador: contratosDoJogador,

    confrontos: confrontos,
    tabela: tabela,
  };
})(window);
