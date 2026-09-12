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
  };

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

    // Campos opcionais: se preenchidos, entram na mensagem do WhatsApp.
    frag.appendChild(
      campoTexto('nomeCliente', 'Seu nome (opcional)', 'Ex.: Maria')
    );
    frag.appendChild(
      campoTexto('enderecoCliente', 'Endereço de entrega (opcional)', 'Rua, número, bairro')
    );

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

  function campoTexto(id, rotulo, dica) {
    var label = criar('label', 'campo');
    label.htmlFor = id;
    label.appendChild(criar('span', null, rotulo));
    var input = criar('input');
    input.type = 'text';
    input.id = id;
    input.placeholder = dica;
    input.autocomplete = id === 'nomeCliente' ? 'name' : 'street-address';
    label.appendChild(input);
    return label;
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
    var nome = (document.getElementById('nomeCliente') || {}).value || '';
    var endereco = (document.getElementById('enderecoCliente') || {}).value || '';

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

    if (nome.trim()) {
      partes.push('');
      partes.push('Nome: ' + nome.trim());
    }
    if (endereco.trim()) {
      if (!nome.trim()) partes.push('');
      partes.push('Endereço: ' + endereco.trim());
    }

    return partes.join('\n');
  }

  function finalizar() {
    var c = contas();
    if (!c.linhas.length) return;
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
        // Sem dados ainda conseguimos mostrar a pagina com os textos padrao.
        estado.loja = estado.loja || { nome: 'Delivery de Caldos', whatsapp: '', taxaEntrega: 0 };
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
