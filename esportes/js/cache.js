/* =====================================================================
   CACHE COM VALIDADE
   Guarda a resposta da API por alguns minutos para nao repetir chamada
   a toa e nao estourar o limite da chave gratuita.

   Fica em memoria + sessionStorage. Sai da memoria quando a aba fecha.
   Se o navegador bloquear o armazenamento (aba anonima, cota cheia),
   continua funcionando so em memoria, sem quebrar nada.
   ===================================================================== */

(function (global) {
  'use strict';

  var cfg = (global.CONFIG && global.CONFIG.cache) || {};
  var PREFIXO = cfg.prefixo || 'esportes:cache:';
  var MAX_ITENS = cfg.maxItens || 200;

  var memoria = new Map();

  /* O sessionStorage pode simplesmente nao existir. Testa uma vez. */
  var temStorage = (function () {
    try {
      var teste = PREFIXO + '__teste';
      sessionStorage.setItem(teste, '1');
      sessionStorage.removeItem(teste);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function fisica(chave) {
    return PREFIXO + chave;
  }

  /* --------------------------------------------------------------- ler */

  /**
   * Devolve null se nunca foi guardado.
   * Se foi, devolve { dados, gravadoEm, idadeMs, vencido }.
   * Repare que um item vencido AINDA volta: quem chamou decide se usa.
   * E isso que deixa o site mostrar dados antigos quando a API cai.
   */
  function ler(chave) {
    var reg = memoria.get(chave);

    if (!reg && temStorage) {
      try {
        var bruto = sessionStorage.getItem(fisica(chave));
        if (bruto) {
          reg = JSON.parse(bruto);
          memoria.set(chave, reg);
        }
      } catch (e) {
        /* json corrompido: joga fora e segue */
        try {
          sessionStorage.removeItem(fisica(chave));
        } catch (e2) {}
      }
    }

    if (!reg || typeof reg.t !== 'number') return null;

    var idade = Date.now() - reg.t;
    return {
      dados: reg.d,
      gravadoEm: reg.t,
      idadeMs: idade,
      vencido: idade > (reg.ttl || 0),
    };
  }

  /* ------------------------------------------------------------ gravar */

  function gravar(chave, dados, ttlMs) {
    var reg = {
      d: dados,
      t: Date.now(),
      ttl: ttlMs || cfg.ttlPadraoMs || 300000,
    };

    memoria.set(chave, reg);
    if (memoria.size > MAX_ITENS) podarMemoria();

    if (!temStorage) return;
    try {
      sessionStorage.setItem(fisica(chave), JSON.stringify(reg));
    } catch (e) {
      /* Cota cheia. Limpa os mais velhos e tenta uma vez so. */
      podarStorage(Math.ceil(MAX_ITENS / 3));
      try {
        sessionStorage.setItem(fisica(chave), JSON.stringify(reg));
      } catch (e2) {
        /* Desiste em silencio: a memoria ja tem o dado. */
      }
    }
  }

  /* ------------------------------------------------------------- podar */

  function podarMemoria() {
    /* Map preserva ordem de insercao: os primeiros sao os mais velhos. */
    var sobrando = memoria.size - MAX_ITENS;
    var it = memoria.keys();
    for (var i = 0; i < sobrando; i++) {
      var k = it.next();
      if (k.done) break;
      memoria.delete(k.value);
    }
  }

  function podarStorage(quantos) {
    if (!temStorage) return;
    var itens = [];
    try {
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (!k || k.indexOf(PREFIXO) !== 0) continue;
        var t = 0;
        try {
          t = (JSON.parse(sessionStorage.getItem(k)) || {}).t || 0;
        } catch (e) {}
        itens.push({ k: k, t: t });
      }
      itens.sort(function (a, b) {
        return a.t - b.t;
      });
      for (var j = 0; j < Math.min(quantos, itens.length); j++) {
        sessionStorage.removeItem(itens[j].k);
      }
    } catch (e) {}
  }

  /* ---------------------------------------------------------- invalidar */

  function invalidar(chave) {
    memoria.delete(chave);
    if (!temStorage) return;
    try {
      sessionStorage.removeItem(fisica(chave));
    } catch (e) {}
  }

  /** Apaga tudo que comeca com um pedaco de texto. Ex: limpar('eventsday') */
  function limpar(comecoDaChave) {
    var alvos = [];
    memoria.forEach(function (_, k) {
      if (!comecoDaChave || k.indexOf(comecoDaChave) === 0) alvos.push(k);
    });
    alvos.forEach(invalidar);

    if (!temStorage) return;
    try {
      var remover = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (!k || k.indexOf(PREFIXO) !== 0) continue;
        var curta = k.slice(PREFIXO.length);
        if (!comecoDaChave || curta.indexOf(comecoDaChave) === 0) remover.push(k);
      }
      remover.forEach(function (k) {
        sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }

  function estatisticas() {
    return { itens: memoria.size, storage: temStorage };
  }

  global.Cache = {
    ler: ler,
    gravar: gravar,
    invalidar: invalidar,
    limpar: limpar,
    estatisticas: estatisticas,
  };
})(window);
