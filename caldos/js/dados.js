/* =====================================================================
   CAMADA DE DADOS
   ---------------------------------------------------------------------
   Todo o resto do site (cardapio e painel) fala com este arquivo e nao
   precisa saber onde os dados estao guardados.

   Dois modos, escolhidos sozinhos a partir do js/config.js:

     MODO LOCAL  — sem Supabase configurado. Guarda tudo no localStorage
                   do navegador. Bom para testar; o cardapio NAO e
                   compartilhado com outros aparelhos.

     MODO NUVEM  — com `supabase.url` e `supabase.anonKey` preenchidos.
                   Guarda no banco de dados e nas fotos do Supabase, e
                   todo cliente ve as mudancas na hora.
   ===================================================================== */

(function () {
  'use strict';

  var CFG = window.CALDOS_CONFIG || {};
  var CHAVE_DADOS = 'caldos:dados';
  var CHAVE_SESSAO = 'caldos:admin-logado';

  var temNuvem = !!(CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey);
  var sb = null; // cliente Supabase, criado sob demanda

  /* ---------------------------------------------------------------- util */

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function novoId() {
    if (window.crypto && window.crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function numero(valor) {
    var n = typeof valor === 'number' ? valor : parseFloat(valor);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // Normaliza um item vindo de qualquer fonte (padrao, localStorage, banco)
  // para o formato que as telas esperam. Item invalido volta como null.
  function normalizarItem(bruto, indice) {
    if (!bruto || typeof bruto !== 'object') return null;
    var nome = String(bruto.nome == null ? '' : bruto.nome).trim();
    if (!nome) return null;
    return {
      id: bruto.id ? String(bruto.id) : novoId(),
      nome: nome,
      preco: numero(bruto.preco),
      descricao: String(
        bruto.descricao == null ? '' : bruto.descricao
      ).trim(),
      foto: bruto.foto ? String(bruto.foto) : '',
      ativo: bruto.ativo !== false,
      ordem:
        typeof bruto.ordem === 'number' && isFinite(bruto.ordem)
          ? bruto.ordem
          : indice + 1,
    };
  }

  function normalizarLoja(bruto) {
    var p = (CFG.padrao && CFG.padrao.loja) || {};
    var l = bruto && typeof bruto === 'object' ? bruto : {};
    function texto(a, b) {
      var v = a == null ? b : a;
      return String(v == null ? '' : v);
    }
    return {
      nome: texto(l.nome, p.nome) || 'Delivery de Caldos',
      bannerTitulo: texto(l.bannerTitulo, p.bannerTitulo),
      bannerTexto: texto(l.bannerTexto, p.bannerTexto),
      // No WhatsApp guardamos so digitos: e assim que o link wa.me espera.
      whatsapp: texto(l.whatsapp, p.whatsapp).replace(/\D/g, ''),
      horario: texto(l.horario, p.horario),
      areaEntrega: texto(l.areaEntrega, p.areaEntrega),
      taxaEntrega: numero(l.taxaEntrega == null ? p.taxaEntrega : l.taxaEntrega),
    };
  }

  function ordenar(itens) {
    return itens.slice().sort(function (a, b) {
      return a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }

  function padraoCompleto() {
    var p = CFG.padrao || {};
    var itens = (p.itens || [])
      .map(normalizarItem)
      .filter(Boolean);
    return { loja: normalizarLoja(p.loja), itens: ordenar(itens) };
  }

  /* ------------------------------------------------------ hash da senha */

  function sha256(texto) {
    // crypto.subtle so existe em https:// e em localhost. Aberto direto do
    // arquivo (file://) ele falta, e nesse caso comparamos sem hash.
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve(null);
    var bytes = new TextEncoder().encode(texto);
    return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
    });
  }

  /* ----------------------------------------------------- redimensionar foto */

  var FOTO_LARGURA_MAX = 900;
  var FOTO_QUALIDADE = 0.72;

  // Fotos de celular tem varios MB — grandes demais para o localStorage e
  // lentas para o cliente baixar. Reduzimos antes de guardar.
  function reduzirFoto(arquivo) {
    return new Promise(function (ok, erro) {
      if (!arquivo || !/^image\//.test(arquivo.type)) {
        erro(new Error('Escolha um arquivo de imagem (JPG, PNG ou WEBP).'));
        return;
      }
      var leitor = new FileReader();
      leitor.onerror = function () {
        erro(new Error('Não consegui ler essa imagem.'));
      };
      leitor.onload = function () {
        var img = new Image();
        img.onerror = function () {
          erro(new Error('Essa imagem parece estar corrompida.'));
        };
        img.onload = function () {
          var escala = Math.min(1, FOTO_LARGURA_MAX / img.width);
          var largura = Math.round(img.width * escala);
          var altura = Math.round(img.height * escala);
          var tela = document.createElement('canvas');
          tela.width = largura;
          tela.height = altura;
          tela.getContext('2d').drawImage(img, 0, 0, largura, altura);
          tela.toBlob(
            function (blob) {
              if (!blob) {
                erro(new Error('Não consegui converter essa imagem.'));
                return;
              }
              var l2 = new FileReader();
              l2.onload = function () {
                ok({ blob: blob, dataUrl: l2.result });
              };
              l2.readAsDataURL(blob);
            },
            'image/jpeg',
            FOTO_QUALIDADE
          );
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* ================================================================ LOCAL */

  var Local = {
    ler: function () {
      var cru = null;
      try {
        cru = localStorage.getItem(CHAVE_DADOS);
      } catch (e) {
        cru = null; // navegador com armazenamento bloqueado
      }
      if (!cru) return padraoCompleto();
      var bruto;
      try {
        bruto = JSON.parse(cru);
      } catch (e) {
        // Dado corrompido nunca derruba o site: caimos no padrao.
        return padraoCompleto();
      }
      var itens = (bruto && bruto.itens ? bruto.itens : [])
        .map(normalizarItem)
        .filter(Boolean);
      return { loja: normalizarLoja(bruto && bruto.loja), itens: ordenar(itens) };
    },

    gravar: function (dados) {
      try {
        localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados));
      } catch (e) {
        throw new Error(
          'O navegador ficou sem espaço para salvar. Exclua algum item ou ' +
            'use fotos menores.'
        );
      }
      return dados;
    },
  };

  /* ================================================================ NUVEM */

  function carregarScript(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = function () {
        erro(new Error('Não consegui carregar a biblioteca do Supabase.'));
      };
      document.head.appendChild(s);
    });
  }

  function cliente() {
    if (sb) return Promise.resolve(sb);
    var pronto = window.supabase
      ? Promise.resolve()
      : carregarScript(
          'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
        );
    return pronto.then(function () {
      sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
      return sb;
    });
  }

  // Traduz uma linha do banco (colunas em snake_case) para o formato das telas.
  function deLinha(linha, indice) {
    return normalizarItem(
      {
        id: linha.id,
        nome: linha.nome,
        preco: linha.preco,
        descricao: linha.descricao,
        foto: linha.foto,
        ativo: linha.ativo,
        ordem: linha.ordem,
      },
      indice
    );
  }

  function paraLinha(item) {
    return {
      id: item.id,
      nome: item.nome,
      preco: item.preco,
      descricao: item.descricao,
      foto: item.foto,
      ativo: item.ativo,
      ordem: item.ordem,
    };
  }

  var Nuvem = {
    ler: function () {
      return cliente().then(function (c) {
        return Promise.all([
          c.from('loja').select('*').eq('id', 1).maybeSingle(),
          c.from('itens').select('*').order('ordem', { ascending: true }),
        ]).then(function (r) {
          var rLoja = r[0];
          var rItens = r[1];
          if (rLoja.error) throw new Error(rLoja.error.message);
          if (rItens.error) throw new Error(rItens.error.message);
          var l = rLoja.data;
          return {
            loja: normalizarLoja(
              l && {
                nome: l.nome,
                bannerTitulo: l.banner_titulo,
                bannerTexto: l.banner_texto,
                whatsapp: l.whatsapp,
                horario: l.horario,
                areaEntrega: l.area_entrega,
                taxaEntrega: l.taxa_entrega,
              }
            ),
            itens: ordenar((rItens.data || []).map(deLinha).filter(Boolean)),
          };
        });
      });
    },

    salvarLoja: function (loja) {
      return cliente().then(function (c) {
        return c
          .from('loja')
          .upsert({
            id: 1,
            nome: loja.nome,
            banner_titulo: loja.bannerTitulo,
            banner_texto: loja.bannerTexto,
            whatsapp: loja.whatsapp,
            horario: loja.horario,
            area_entrega: loja.areaEntrega,
            taxa_entrega: loja.taxaEntrega,
          })
          .then(function (r) {
            if (r.error) throw new Error(r.error.message);
            return loja;
          });
      });
    },

    salvarItem: function (item) {
      return cliente().then(function (c) {
        return c
          .from('itens')
          .upsert(paraLinha(item))
          .then(function (r) {
            if (r.error) throw new Error(r.error.message);
            return item;
          });
      });
    },

    salvarVarios: function (itens) {
      if (!itens.length) return Promise.resolve(itens);
      return cliente().then(function (c) {
        return c
          .from('itens')
          .upsert(itens.map(paraLinha))
          .then(function (r) {
            if (r.error) throw new Error(r.error.message);
            return itens;
          });
      });
    },

    excluirItem: function (id) {
      return cliente().then(function (c) {
        return c
          .from('itens')
          .delete()
          .eq('id', id)
          .then(function (r) {
            if (r.error) throw new Error(r.error.message);
          });
      });
    },

    enviarFoto: function (blob, id) {
      return cliente().then(function (c) {
        var caminho = id + '-' + Date.now() + '.jpg';
        return c.storage
          .from('fotos')
          .upload(caminho, blob, { contentType: 'image/jpeg', upsert: true })
          .then(function (r) {
            if (r.error) throw new Error(r.error.message);
            return c.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
          });
      });
    },
  };

  /* ============================================================= API unica */

  var API = {
    modo: temNuvem ? 'nuvem' : 'local',

    /** Le loja + itens. Sempre devolve um objeto valido. */
    carregar: function () {
      if (!temNuvem) return Promise.resolve(Local.ler());
      return Nuvem.ler();
    },

    /** Salva os dados da loja (nome, WhatsApp, horario, area, banner). */
    salvarLoja: function (loja) {
      var limpa = normalizarLoja(loja);
      if (temNuvem) return Nuvem.salvarLoja(limpa);
      var dados = Local.ler();
      dados.loja = limpa;
      return Promise.resolve(Local.gravar(dados).loja);
    },

    /** Cria (sem id) ou atualiza (com id) um item do cardapio. */
    salvarItem: function (item) {
      var dados;
      var novo = !item.id;
      if (novo) item = Object.assign({}, item, { id: novoId() });

      if (temNuvem) {
        if (novo && typeof item.ordem !== 'number') {
          return Nuvem.ler().then(function (d) {
            item.ordem = d.itens.length + 1;
            return Nuvem.salvarItem(normalizarItem(item, 0));
          });
        }
        return Nuvem.salvarItem(normalizarItem(item, 0));
      }

      dados = Local.ler();
      var limpo = normalizarItem(item, dados.itens.length);
      if (!limpo) return Promise.reject(new Error('O item precisa de um nome.'));
      var i = dados.itens.findIndex(function (x) {
        return x.id === limpo.id;
      });
      if (i >= 0) {
        limpo.ordem = dados.itens[i].ordem;
        dados.itens[i] = limpo;
      } else {
        limpo.ordem = dados.itens.length + 1;
        dados.itens.push(limpo);
      }
      dados.itens = ordenar(dados.itens);
      Local.gravar(dados);
      return Promise.resolve(limpo);
    },

    excluirItem: function (id) {
      if (temNuvem) return Nuvem.excluirItem(id);
      var dados = Local.ler();
      dados.itens = dados.itens.filter(function (x) {
        return x.id !== id;
      });
      Local.gravar(dados);
      return Promise.resolve();
    },

    /** Liga/desliga um item ("esgotado hoje") sem apagar nada. */
    alternarAtivo: function (id) {
      return API.carregar().then(function (dados) {
        var item = dados.itens.find(function (x) {
          return x.id === id;
        });
        if (!item) return null;
        item.ativo = !item.ativo;
        return API.salvarItem(item);
      });
    },

    /** Move um item uma posicao para cima (-1) ou para baixo (+1). */
    mover: function (id, direcao) {
      return API.carregar().then(function (dados) {
        var lista = dados.itens;
        var i = lista.findIndex(function (x) {
          return x.id === id;
        });
        var j = i + direcao;
        if (i < 0 || j < 0 || j >= lista.length) return null;
        var tmp = lista[i];
        lista[i] = lista[j];
        lista[j] = tmp;
        lista.forEach(function (item, k) {
          item.ordem = k + 1;
        });
        if (temNuvem) return Nuvem.salvarVarios(lista);
        dados.itens = lista;
        Local.gravar(dados);
        return Promise.resolve(lista);
      });
    },

    /**
     * Recebe o arquivo escolhido no celular/computador, reduz e devolve o
     * endereco final da foto: um link publico (nuvem) ou a propria imagem
     * embutida (local).
     */
    prepararFoto: function (arquivo, itemId) {
      return reduzirFoto(arquivo).then(function (r) {
        if (temNuvem) return Nuvem.enviarFoto(r.blob, itemId || novoId());
        return r.dataUrl;
      });
    },

    /* ------------------------------------------------------------ acesso */

    /**
     * Modo local: confere a senha simples do config.js.
     * Modo nuvem: entra na conta do Supabase (e-mail + senha), que e o que
     * de fato autoriza gravar no banco.
     */
    entrar: function (senha, email) {
      if (temNuvem) {
        return cliente().then(function (c) {
          return c.auth
            .signInWithPassword({ email: (email || '').trim(), password: senha })
            .then(function (r) {
              if (r.error) return false;
              return true;
            });
        });
      }
      return sha256(senha).then(function (hash) {
        var esperado = CFG.senhaAdminHash || '';
        var ok = hash ? hash === esperado : senha === 'caldos123';
        if (ok) {
          try {
            sessionStorage.setItem(CHAVE_SESSAO, '1');
          } catch (e) {
            /* sem sessionStorage o login apenas nao persiste */
          }
        }
        return ok;
      });
    },

    estaLogado: function () {
      if (temNuvem) {
        return cliente()
          .then(function (c) {
            return c.auth.getSession();
          })
          .then(function (r) {
            return !!(r.data && r.data.session);
          });
      }
      try {
        return Promise.resolve(sessionStorage.getItem(CHAVE_SESSAO) === '1');
      } catch (e) {
        return Promise.resolve(false);
      }
    },

    sair: function () {
      if (temNuvem) {
        return cliente().then(function (c) {
          return c.auth.signOut();
        });
      }
      try {
        sessionStorage.removeItem(CHAVE_SESSAO);
      } catch (e) {
        /* nada a limpar */
      }
      return Promise.resolve();
    },

    /** Gera a linha `senhaAdminHash` para colar no config.js (modo local). */
    hashDeSenha: function (senha) {
      return sha256(senha);
    },

    /* ------------------------------------------------- copia de seguranca */

    exportar: function () {
      return API.carregar().then(function (dados) {
        return JSON.stringify(clonar(dados), null, 2);
      });
    },

    importar: function (texto) {
      var bruto;
      try {
        bruto = JSON.parse(texto);
      } catch (e) {
        return Promise.reject(new Error('Esse arquivo não é um backup válido.'));
      }
      var itens = (bruto && bruto.itens ? bruto.itens : [])
        .map(normalizarItem)
        .filter(Boolean);
      if (!itens.length && !(bruto && bruto.loja)) {
        return Promise.reject(new Error('Não encontrei nenhum item nesse arquivo.'));
      }
      itens.forEach(function (item, i) {
        item.ordem = i + 1;
      });
      var dados = { loja: normalizarLoja(bruto && bruto.loja), itens: itens };
      if (!temNuvem) return Promise.resolve(Local.gravar(dados));
      return Nuvem.salvarLoja(dados.loja)
        .then(function () {
          return Nuvem.salvarVarios(dados.itens);
        })
        .then(function () {
          return dados;
        });
    },
  };

  window.Dados = API;
})();
