/* =====================================================================
   PAGINA DO CLIENTE — cardapio, carrinho e envio do pedido pelo WhatsApp
   ===================================================================== */

(function () {
  'use strict';

  var CHAVE_CARRINHO = 'caldos:carrinho';

  var estado = {
    loja: null,
    itens: [],
    carrinho: {}, // { idDoItem: quantidade }
    quantidades: {}, // quantidade escolhida no cartao, antes de adicionar
    // Dados da entrega. Ficam aqui, e nao apenas nos campos da tela, porque
    // o rodape do carrinho e refeito a cada mudanca de quantidade — sem
    // isso o cliente perderia o que digitou ao mexer no pedido.
    entrega: { nome: '', endereco: '', complemento: '' },
    erros: {}, // { chave: true } para os campos obrigatorios em falta
    // So cobramos os campos depois da primeira tentativa de finalizar: nada
    // de acusar falta antes de a pessoa ter tido chance de preencher.
    tentouFinalizar: false,
  };

  // Um so lugar descreve os campos: a tela, a conferencia e a mensagem do
  // WhatsApp sao todas montadas a partir daqui.
  var CAMPOS_ENTREGA = [
    {
      chave: 'nome',
      id: 'nomeCliente',
      rotulo: 'Seu nome',
      dica: 'Ex.: Maria Silva',
      autocomplete: 'name',
      obrigatorio: true,
      limite: 80,
      cobranca: 'Escreva o seu nome.',
    },
    {
      chave: 'endereco',
      id: 'enderecoCliente',
      rotulo: 'Endereço completo',
      dica: 'Rua, número e bairro',
      autocomplete: 'street-address',
      obrigatorio: true,
      limite: 160,
      cobranca: 'Escreva o endereço com rua, número e bairro.',
    },
    {
      chave: 'complemento',
      id: 'complementoCliente',
      rotulo: 'Complemento',
      dica: 'Apartamento, bloco ou ponto de referência',
      autocomplete: 'address-line2',
      obrigatorio: false,
      limite: 120,
    },
  ];

  var dinheiro = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  /* ----------------------------------------------------------- ajudantes */

  function $(sel) {
    return document.querySelector(sel);
  }

  function criar(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
  }

  function lerCarrinho() {
    try {
      var cru = localStorage.getItem(CHAVE_CARRINHO);
      var bruto = cru ? JSON.parse(cru) : {};
      var limpo = {};
      Object.keys(bruto).forEach(function (id) {
        var q = parseInt(bruto[id], 10);
        if (q > 0) limpo[id] = Math.min(q, 99);
      });
      return limpo;
    } catch (e) {
      return {};
    }
  }

  function gravarCarrinho() {
    try {
      localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(estado.carrinho));
    } catch (e) {
      /* sem localStorage o carrinho vale so para esta visita */
    }
  }

  function itemPorId(id) {
    return estado.itens.find(function (x) {
      return x.id === id;
    });
  }

  // Somente itens ativos entram na conta: um caldo marcado como esgotado
  // depois que o cliente ja tinha adicionado sai do carrinho.
  function linhasDoCarrinho() {
    return Object.keys(estado.carrinho)
      .map(function (id) {
        var item = itemPorId(id);
        if (!item || !item.ativo) return null;
        var qtd = estado.carrinho[id];
        return { item: item, qtd: qtd, total: item.preco * qtd };
      })
      .filter(Boolean);
  }

  function limparCarrinhoInvalido() {
    var mudou = false;
    Object.keys(estado.carrinho).forEach(function (id) {
      var item = itemPorId(id);
      if (!item || !item.ativo) {
        delete estado.carrinho[id];
        mudou = true;
      }
    });
    if (mudou) gravarCarrinho();
  }

  function contas() {
    var linhas = linhasDoCarrinho();
    var subtotal = linhas.reduce(function (soma, l) {
      return soma + l.total;
    }, 0);
    var qtdTotal = linhas.reduce(function (soma, l) {
      return soma + l.qtd;
    }, 0);
    var taxa = linhas.length ? estado.loja.taxaEntrega : 0;
    return {
      linhas: linhas,
      subtotal: subtotal,
      taxa: taxa,
      total: subtotal + taxa,
      qtdTotal: qtdTotal,
    };
  }

  /* ------------------------------------------------------- dados da loja */

  function pintarLoja() {
    var loja = estado.loja;

    document.title = loja.nome + ' — Delivery de Caldos';

    Array.prototype.forEach.call(
      document.querySelectorAll('[data-loja]'),
      function (el) {
        var valor = loja[el.getAttribute('data-loja')];
        el.textContent = valor || '';
      }
    );

    // Linhas do banner desaparecem quando o campo esta vazio, em vez de
    // deixar um icone solto.
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-linha]'),
      function (el) {
        var vazio = !loja[el.getAttribute('data-linha')];
        el.classList.toggle('escondido', vazio);
      }
    );

    var zap = $('#zapRodape');
    if (loja.whatsapp) {
      zap.href = 'https://wa.me/' + loja.whatsapp;
      zap.textContent = 'Falar com a gente';
    } else {
      zap.removeAttribute('href');
      zap.textContent = 'WhatsApp ainda não configurado';
    }

    $('#ano').textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------------- cardapio */

  function pintarCardapio() {
    var grade = $('#grade');
    var aviso = $('#avisoCardapio');
    grade.textContent = '';
    aviso.textContent = '';

    var visiveis = estado.itens;

    $('#contagemCardapio').textContent = visiveis.length
      ? visiveis.length + (visiveis.length === 1 ? ' opção' : ' opções')
      : '';

    if (!visiveis.length) {
      var vazio = criar('div', 'vazio');
      vazio.appendChild(criar('strong', null, 'O cardápio está sendo montado'));
      vazio.appendChild(
        criar(
          'span',
          null,
          'Volte em alguns minutos — os caldos de hoje aparecem aqui.'
        )
      );
      grade.appendChild(vazio);
      return;
    }

    visiveis.forEach(function (item) {
      grade.appendChild(cartaoDoItem(item));
    });
  }

  function cartaoDoItem(item) {
    var cartao = criar('article', 'cartao' + (item.ativo ? '' : ' cartao--esgotado'));

    var foto = criar('div', 'cartao__foto' + (item.foto ? '' : ' cartao__foto--vazia'));
    if (item.foto) {
      var img = criar('img');
      img.src = item.foto;
      img.alt = item.nome;
      img.loading = 'lazy';
      foto.appendChild(img);
    }
    if (!item.ativo) {
      foto.appendChild(criar('div', 'faixa-esgotado', 'Esgotado hoje'));
    }
    cartao.appendChild(foto);

    var corpo = criar('div', 'cartao__corpo');
    corpo.appendChild(criar('h3', 'cartao__nome', item.nome));
    if (item.descricao) {
      corpo.appendChild(criar('p', 'cartao__descricao', item.descricao));
    }
    corpo.appendChild(criar('div', 'cartao__preco', dinheiro.format(item.preco)));

    var acoes = criar('div', 'cartao__acoes');

    if (item.ativo) {
      acoes.appendChild(contadorDoCartao(item));
      var add = criar('button', 'botao', 'Adicionar');
      add.type = 'button';
      add.addEventListener('click', function () {
        adicionar(item.id);
      });
      acoes.appendChild(add);
    } else {
      var indisponivel = criar('button', 'botao botao--neutro', 'Indisponível');
      indisponivel.type = 'button';
      indisponivel.disabled = true;
      acoes.appendChild(indisponivel);
    }

    corpo.appendChild(acoes);
    cartao.appendChild(corpo);
    return cartao;
  }

  function contadorDoCartao(item) {
    var atual = estado.quantidades[item.id] || 1;
    estado.quantidades[item.id] = atual;

    var caixa = criar('div', 'contador');
    var menos = criar('button', null, '−');
    var valor = criar('span', 'valor', String(atual));
    var mais = criar('button', null, '+');

    menos.type = 'button';
    mais.type = 'button';
    menos.setAttribute('aria-label', 'Menos um ' + item.nome);
    mais.setAttribute('aria-label', 'Mais um ' + item.nome);
    menos.disabled = atual <= 1;

    function ajustar(passo) {
      var novo = Math.min(99, Math.max(1, estado.quantidades[item.id] + passo));
      estado.quantidades[item.id] = novo;
      valor.textContent = String(novo);
      menos.disabled = novo <= 1;
      mais.disabled = novo >= 99;
    }

    menos.addEventListener('click', function () {
      ajustar(-1);
    });
    mais.addEventListener('click', function () {
      ajustar(1);
    });

    caixa.appendChild(menos);
    caixa.appendChild(valor);
    caixa.appendChild(mais);
    return caixa;
  }

  function adicionar(id) {
    var qtd = estado.quantidades[id] || 1;
    estado.carrinho[id] = Math.min(99, (estado.carrinho[id] || 0) + qtd);
    estado.quantidades[id] = 1;
    gravarCarrinho();
    pintarCardapio();
    pintarCarrinho();
    abrirCarrinho();
  }

  /* ----------------------------------------------------------- carrinho */

  function pintarCarrinho() {
    limparCarrinhoInvalido();

    var c = contas();
    var corpo = $('#corpoCarrinho');
    var pe = $('#peCarrinho');
    corpo.textContent = '';
    pe.textContent = '';

    // resumo do topo e barra fixa
    $('#topoTotal').textContent = dinheiro.format(c.total);
    var selo = $('#seloCarrinho');
    selo.textContent = String(c.qtdTotal);
    selo.classList.toggle('escondido', c.qtdTotal === 0);
    $('#topoLeitor').textContent = c.qtdTotal
      ? c.qtdTotal + ' itens no carrinho, total ' + dinheiro.format(c.total)
      : 'Carrinho vazio';

    $('#barraItens').textContent =
      c.qtdTotal + (c.qtdTotal === 1 ? ' item' : ' itens');
    $('#barraValor').textContent = dinheiro.format(c.total);
    var barra = $('#barraResumo');
    var mostrarBarra = c.qtdTotal > 0 && !document.body.classList.contains('carrinho-aberto');
    barra.classList.toggle('aparece', mostrarBarra);
    barra.setAttribute('aria-hidden', mostrarBarra ? 'false' : 'true');
    document.body.classList.toggle('tem-barra', c.qtdTotal > 0);

    if (!c.linhas.length) {
      var vazio = criar('div', 'vazio');
      vazio.appendChild(criar('strong', null, 'Seu carrinho está vazio'));
      vazio.appendChild(
        criar('span', null, 'Escolha um caldo no cardápio para começar.')
      );
      corpo.appendChild(vazio);
      return;
    }

    c.linhas.forEach(function (linha) {
      corpo.appendChild(linhaDoCarrinho(linha));
    });

    pe.appendChild(blocoContas(c));
    // O rodape acabou de ser refeito: as marcas de erro voltam pelo estado,
    // dentro de `campoEntrega`, e o aviso e redesenhado aqui.
    pintarAvisoEntrega();
  }

  function linhaDoCarrinho(linha) {
    var item = linha.item;
    var el = criar('div', 'linha-carrinho');

    var foto = criar('div', 'linha-carrinho__foto');
    if (item.foto) {
      var img = criar('img');
      img.src = item.foto;
      img.alt = '';
      foto.appendChild(img);
    } else {
      foto.appendChild(criar('span', null, '🍲'));
    }
    el.appendChild(foto);

    var meio = criar('div');
    meio.appendChild(criar('div', 'linha-carrinho__nome', item.nome));
    meio.appendChild(
      criar('div', 'linha-carrinho__unidade', dinheiro.format(item.preco) + ' cada')
    );
    meio.appendChild(contadorDaLinha(item, linha.qtd));
    el.appendChild(meio);

    var direita = criar('div', 'linha-carrinho__direita');
    direita.appendChild(
      criar('div', 'linha-carrinho__total', dinheiro.format(linha.total))
    );
    var remover = criar('button', 'remover', 'Remover');
    remover.type = 'button';
    remover.addEventListener('click', function () {
      delete estado.carrinho[item.id];
      gravarCarrinho();
      pintarCarrinho();
    });
    direita.appendChild(remover);
    el.appendChild(direita);

    return el;
  }

  function contadorDaLinha(item, qtd) {
    var caixa = criar('div', 'contador');
    caixa.style.marginTop = '8px';

    var menos = criar('button', null, '−');
    var valor = criar('span', 'valor', String(qtd));
    var mais = criar('button', null, '+');
    menos.type = 'button';
    mais.type = 'button';
    menos.setAttribute('aria-label', 'Diminuir ' + item.nome);
    mais.setAttribute('aria-label', 'Aumentar ' + item.nome);
    mais.disabled = qtd >= 99;

    function ajustar(passo) {
      var novo = (estado.carrinho[item.id] || 0) + passo;
      if (novo <= 0) delete estado.carrinho[item.id];
      else estado.carrinho[item.id] = Math.min(99, novo);
      gravarCarrinho();
      pintarCarrinho();
    }

    menos.addEventListener('click', function () {
      ajustar(-1);
    });
    mais.addEventListener('click', function () {
      ajustar(1);
    });

    caixa.appendChild(menos);
    caixa.appendChild(valor);
    caixa.appendChild(mais);
    return caixa;
  }

  function blocoContas(c) {
    var frag = document.createDocumentFragment();

    var contasEl = criar('div', 'contas');
    contasEl.appendChild(duasColunas('Subtotal', dinheiro.format(c.subtotal)));
    if (c.taxa > 0) {
      contasEl.appendChild(duasColunas('Taxa de entrega', dinheiro.format(c.taxa)));
    }
    var total = duasColunas('Total', dinheiro.format(c.total));
    total.className = 'total';
    contasEl.appendChild(total);
    frag.appendChild(contasEl);

    // Dados da entrega: vao junto na mensagem do WhatsApp.
    var entrega = criar('div', 'entrega');
    entrega.appendChild(criar('h3', 'entrega__titulo', 'Dados para a entrega'));
    CAMPOS_ENTREGA.forEach(function (def) {
      entrega.appendChild(campoEntrega(def));
    });
    frag.appendChild(entrega);

    var avisoEntrega = criar('div');
    avisoEntrega.id = 'avisoEntrega';
    frag.appendChild(avisoEntrega);

    var botao = criar('button', 'botao botao--zap');
    botao.type = 'button';
    botao.appendChild(criar('span', null, '🟢'));
    botao.appendChild(criar('span', null, 'Finalizar pedido no WhatsApp'));

    if (!estado.loja.whatsapp) {
      botao.disabled = true;
      var alerta = criar(
        'div',
        'aviso aviso--atencao',
        'O número de WhatsApp ainda não foi cadastrado no painel.'
      );
      frag.appendChild(alerta);
    } else {
      botao.addEventListener('click', finalizar);
    }

    frag.appendChild(botao);
    return frag;
  }

  function duasColunas(rotulo, valor) {
    var el = criar('div');
    el.appendChild(criar('span', null, rotulo));
    el.appendChild(criar('span', null, valor));
    return el;
  }

  function campoEntrega(def) {
    var comErro = !!estado.erros[def.chave];
    var label = criar('label', 'campo' + (comErro ? ' campo--erro' : ''));
    label.htmlFor = def.id;

    var titulo = criar('span', null, def.rotulo);
    titulo.appendChild(
      criar(
        'em',
        def.obrigatorio ? 'campo__marca' : 'campo__marca campo__marca--leve',
        def.obrigatorio ? ' obrigatório' : ' opcional'
      )
    );
    label.appendChild(titulo);

    var input = criar('input');
    input.type = 'text';
    input.id = def.id;
    input.placeholder = def.dica;
    input.autocomplete = def.autocomplete;
    input.maxLength = def.limite;
    input.value = estado.entrega[def.chave];
    if (def.obrigatorio) input.required = true;
    input.setAttribute('aria-invalid', comErro ? 'true' : 'false');

    // Guardar a cada tecla e o que faz o valor sobreviver ao redesenho do
    // rodape quando o cliente muda uma quantidade.
    input.addEventListener('input', function () {
      estado.entrega[def.chave] = input.value;
      if (estado.erros[def.chave] && input.value.trim()) {
        delete estado.erros[def.chave];
        label.classList.remove('campo--erro');
        input.setAttribute('aria-invalid', 'false');
      }
      // O aviso acompanha o que a pessoa esta corrigindo: some quando nao
      // falta mais nada, em vez de continuar cobrando um campo ja preenchido.
      pintarAvisoEntrega();
    });

    label.appendChild(input);
    return label;
  }

  /** Devolve os campos obrigatorios que estao em branco. */
  function faltandoNaEntrega() {
    return CAMPOS_ENTREGA.filter(function (def) {
      return def.obrigatorio && !estado.entrega[def.chave].trim();
    });
  }

  /* --------------------------------------------------- abrir / fechar */

  function abrirCarrinho() {
    $('#gaveta').classList.add('aberta');
    $('#gaveta').setAttribute('aria-hidden', 'false');
    $('#cortina').classList.add('aberta');
    document.body.classList.add('carrinho-aberto');
    document.body.style.overflow = 'hidden';
    $('#barraResumo').classList.remove('aparece');
    $('#fecharCarrinho').focus();
  }

  function fecharCarrinho() {
    $('#gaveta').classList.remove('aberta');
    $('#gaveta').setAttribute('aria-hidden', 'true');
    $('#cortina').classList.remove('aberta');
    document.body.classList.remove('carrinho-aberto');
    document.body.style.overflow = '';
    pintarCarrinho();
    $('#abrirCarrinho').focus();
  }

  /* ------------------------------------------------------ finalizar pedido */

  function montarMensagem(c) {
    var partes = ['*Novo pedido — ' + estado.loja.nome + '*', ''];

    c.linhas.forEach(function (l) {
      partes.push(
        '• ' + l.qtd + 'x ' + l.item.nome + ' — ' + dinheiro.format(l.total)
      );
    });

    partes.push('');
    partes.push('Subtotal: ' + dinheiro.format(c.subtotal));
    if (c.taxa > 0) partes.push('Taxa de entrega: ' + dinheiro.format(c.taxa));
    partes.push('*Total: ' + dinheiro.format(c.total) + '*');

    partes.push('');
    partes.push('*Entrega*');
    partes.push('Nome: ' + estado.entrega.nome.trim());
    partes.push('Endereço: ' + estado.entrega.endereco.trim());
    if (estado.entrega.complemento.trim()) {
      partes.push('Complemento: ' + estado.entrega.complemento.trim());
    }

    return partes.join('\n');
  }

  /**
   * Desenha (ou apaga) o aviso do que ainda falta. Sempre olha o estado atual,
   * entao serve tanto para a tentativa de finalizar quanto para acompanhar a
   * pessoa enquanto ela corrige.
   */
  function pintarAvisoEntrega() {
    var aviso = document.getElementById('avisoEntrega');
    if (!aviso) return;
    aviso.textContent = '';
    if (!estado.tentouFinalizar) return;

    var faltando = faltandoNaEntrega();
    if (!faltando.length) return;

    var caixa = criar('div', 'aviso aviso--erro');
    caixa.setAttribute('role', 'alert');
    caixa.appendChild(
      criar(
        'strong',
        null,
        faltando.length === 1
          ? 'Falta um dado para a entrega:'
          : 'Faltam dados para a entrega:'
      )
    );
    var lista = criar('ul', 'aviso__lista');
    faltando.forEach(function (def) {
      lista.appendChild(criar('li', null, def.cobranca));
    });
    caixa.appendChild(lista);
    aviso.appendChild(caixa);
  }

  /** Marca os campos em falta, explica o que falta e leva o foco ao primeiro. */
  function cobrarCamposFaltando(faltando) {
    estado.erros = {};
    faltando.forEach(function (def) {
      estado.erros[def.chave] = true;
      var input = document.getElementById(def.id);
      if (!input) return;
      input.setAttribute('aria-invalid', 'true');
      if (input.parentNode) input.parentNode.classList.add('campo--erro');
    });

    pintarAvisoEntrega();

    var primeiro = document.getElementById(faltando[0].id);
    if (primeiro) {
      primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
      primeiro.focus();
    }
  }

  function finalizar() {
    var c = contas();
    if (!c.linhas.length) return;

    estado.tentouFinalizar = true;

    var faltando = faltandoNaEntrega();
    if (faltando.length) {
      cobrarCamposFaltando(faltando);
      return;
    }

    estado.erros = {};
    pintarAvisoEntrega();

    var url =
      'https://wa.me/' +
      estado.loja.whatsapp +
      '?text=' +
      encodeURIComponent(montarMensagem(c));
    window.open(url, '_blank', 'noopener');
  }

  /* ---------------------------------------------------------- inicio */

  function ligarEventos() {
    $('#abrirCarrinho').addEventListener('click', abrirCarrinho);
    $('#barraVerCarrinho').addEventListener('click', abrirCarrinho);
    $('#fecharCarrinho').addEventListener('click', fecharCarrinho);
    $('#cortina').addEventListener('click', fecharCarrinho);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('carrinho-aberto')) {
        fecharCarrinho();
      }
    });
  }

  function mostrarFalha(mensagem) {
    var aviso = $('#avisoCardapio');
    aviso.textContent = '';
    aviso.appendChild(
      criar(
        'div',
        'aviso aviso--erro',
        'Não consegui carregar o cardápio agora. ' + mensagem
      )
    );
  }

  function iniciar() {
    estado.carrinho = lerCarrinho();
    ligarEventos();

    window.Dados.carregar()
      .then(function (dados) {
        estado.loja = dados.loja;
        estado.itens = dados.itens;
        pintarLoja();
        pintarCardapio();
        pintarCarrinho();
      })
      .catch(function (erro) {
        // Banco fora do ar: a pagina continua de pe com os dados do
        // config.js — nome, horario, area e, o que mais importa, o
        // WhatsApp, para o cliente conseguir pedir mesmo assim. O cardapio
        // fica vazio de proposito: mostrar precos que talvez tenham mudado
        // seria pior do que nao mostrar nada.
        estado.loja = estado.loja || window.Dados.padrao().loja;
        estado.itens = [];
        pintarLoja();
        pintarCardapio();
        pintarCarrinho();
        mostrarFalha(erro && erro.message ? erro.message : '');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
