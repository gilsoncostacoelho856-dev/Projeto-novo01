/* =====================================================================
   PAINEL DE ADMINISTRACAO
   Cadastro dos caldos, dados da loja, copia de seguranca e senha.
   ===================================================================== */

(function () {
  'use strict';

  var estado = {
    loja: null,
    itens: [],
    fotoAtual: '', // foto do item que esta no formulario
  };

  var dinheiro = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  /* ----------------------------------------------------------- ajudantes */

  function $(id) {
    return document.getElementById(id);
  }

  function criar(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
  }

  function recado(alvo, tipo, texto) {
    var caixa = typeof alvo === 'string' ? $(alvo) : alvo;
    caixa.textContent = '';
    if (!texto) return;
    caixa.appendChild(criar('div', 'aviso aviso--' + tipo, texto));
  }

  // Recados de sucesso somem sozinhos: o painel nao acumula faixas verdes.
  function recadoTemporario(alvo, tipo, texto) {
    recado(alvo, tipo, texto);
    var caixa = typeof alvo === 'string' ? $(alvo) : alvo;
    setTimeout(function () {
      if (caixa.textContent === texto) caixa.textContent = '';
    }, 4000);
  }

  function mensagemDeErro(erro) {
    return erro && erro.message ? erro.message : 'Algo deu errado. Tente de novo.';
  }

  /**
   * Deixa o numero no formato que o link wa.me espera: so digitos, com o
   * codigo do pais na frente. Um numero brasileiro digitado com DDD
   * (10 ou 11 digitos) recebe o 55 automaticamente.
   */
  function normalizarWhatsapp(valor) {
    var d = String(valor || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) return '55' + d;
    return d;
  }

  function formatarWhatsapp(digitos) {
    var d = String(digitos || '');
    if (/^55\d{10,11}$/.test(d)) d = d.slice(2);
    if (d.length === 11) return d.slice(0, 2) + ' ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return d.slice(0, 2) + ' ' + d.slice(2, 6) + '-' + d.slice(6);
    return d;
  }

  function baixarArquivo(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ================================================================ ENTRADA */

  function prepararEntrada() {
    var nuvem = window.Dados.modo === 'nuvem';
    $('campoEmail').classList.toggle('escondido', !nuvem);
    $('email').required = nuvem;
    $('entradaSubtitulo').textContent = nuvem
      ? 'Entre com a conta que você criou no Supabase.'
      : 'Entre para editar os caldos da sua loja.';

    $('formEntrada').addEventListener('submit', function (e) {
      e.preventDefault();
      var botao = $('botaoEntrar');
      botao.disabled = true;
      botao.textContent = 'Entrando…';
      recado('entradaAviso', 'erro', '');

      window.Dados.entrar($('senha').value, $('email').value)
        .then(function (ok) {
          if (ok) {
            $('senha').value = '';
            abrirPainel();
            return;
          }
          recado(
            'entradaAviso',
            'erro',
            nuvem
              ? 'E-mail ou senha não conferem.'
              : 'Senha incorreta. Tente de novo.'
          );
        })
        .catch(function (erro) {
          recado('entradaAviso', 'erro', mensagemDeErro(erro));
        })
        .then(function () {
          botao.disabled = false;
          botao.textContent = 'Entrar';
        });
    });
  }

  function abrirPainel() {
    $('telaEntrada').classList.add('escondido');
    $('telaPainel').classList.remove('escondido');
    prepararPainel();
    carregar();
  }

  /* ================================================================ PAINEL */

  var painelPronto = false;

  function prepararPainel() {
    if (painelPronto) return;
    painelPronto = true;

    var nuvem = window.Dados.modo === 'nuvem';
    $('etiquetaModo').textContent = nuvem ? 'nuvem' : 'só neste aparelho';
    $('textoModo').textContent = nuvem
      ? 'Modo nuvem: o cardápio está num banco de dados na internet. Tudo que ' +
        'você salva aqui aparece na hora para qualquer cliente, em qualquer celular.'
      : 'Modo local: o cardápio está salvo apenas na memória deste navegador. ' +
        'Serve muito bem para testar, mas os clientes que abrirem o site em ' +
        'outros aparelhos não vão ver essas mudanças. Para valer para todos, ' +
        'configure o modo nuvem (instruções no arquivo LEIA-ME.md).';
    // Trocar a senha só faz sentido no modo local: na nuvem quem manda é a
    // senha da conta do Supabase, trocada lá.
    $('blocoSenha').classList.toggle('escondido', nuvem);

    ligarAbas();
    ligarFormItem();
    ligarFormLoja();
    ligarExtras();

    $('botaoSair').addEventListener('click', function () {
      window.Dados.sair().then(function () {
        window.location.reload();
      });
    });
  }

  function ligarAbas() {
    var abas = document.querySelectorAll('.aba');
    var paineis = {
      cardapio: $('abaCardapio'),
      loja: $('abaLoja'),
      extras: $('abaExtras'),
    };
    Array.prototype.forEach.call(abas, function (aba) {
      aba.addEventListener('click', function () {
        var alvo = aba.getAttribute('data-aba');
        Array.prototype.forEach.call(abas, function (outra) {
          outra.setAttribute(
            'aria-selected',
            outra === aba ? 'true' : 'false'
          );
        });
        Object.keys(paineis).forEach(function (nome) {
          paineis[nome].classList.toggle('escondido', nome !== alvo);
        });
      });
    });
  }

  function carregar() {
    window.Dados.carregar()
      .then(function (dados) {
        estado.loja = dados.loja;
        estado.itens = dados.itens;
        recado('painelAviso', 'erro', '');
        pintarLista();
        preencherFormLoja();
      })
      .catch(function (erro) {
        recado(
          'painelAviso',
          'erro',
          'Não consegui carregar o cardápio: ' + mensagemDeErro(erro)
        );
        $('resumoItens').textContent = '';
      });
  }

  /* -------------------------------------------------- formulario do item */

  function ligarFormItem() {
    $('botaoEscolherFoto').addEventListener('click', function () {
      $('arquivoFoto').click();
    });

    $('arquivoFoto').addEventListener('change', function () {
      var arquivo = this.files && this.files[0];
      if (!arquivo) return;
      recado('itemAviso', 'ok', 'Preparando a foto…');
      window.Dados.prepararFoto(arquivo, $('itemId').value)
        .then(function (endereco) {
          estado.fotoAtual = endereco;
          pintarPrevia();
          recado('itemAviso', 'erro', '');
        })
        .catch(function (erro) {
          recado('itemAviso', 'erro', mensagemDeErro(erro));
        });
      this.value = '';
    });

    $('botaoTirarFoto').addEventListener('click', function () {
      estado.fotoAtual = '';
      pintarPrevia();
    });

    // "Sem descrição" e a descricao sao a mesma decisao vista de dois lados.
    $('itemSemDescricao').addEventListener('change', function () {
      var semDescricao = this.checked;
      $('itemDescricao').disabled = semDescricao;
      if (semDescricao) $('itemDescricao').value = '';
      contarLetras();
    });

    $('itemDescricao').addEventListener('input', contarLetras);

    $('botaoCancelarEdicao').addEventListener('click', limparFormItem);

    $('formItem').addEventListener('submit', salvarItem);

    contarLetras();
    pintarPrevia();
  }

  function contarLetras() {
    var n = $('itemDescricao').value.length;
    $('contaLetras').textContent = n + ' de 280 caracteres';
  }

  function pintarPrevia() {
    var previa = $('fotoPrevia');
    previa.textContent = '';
    var tem = !!estado.fotoAtual;
    previa.classList.toggle('foto-previa--vazia', !tem);
    $('botaoTirarFoto').classList.toggle('escondido', !tem);
    if (tem) {
      var img = criar('img');
      img.src = estado.fotoAtual;
      img.alt = 'Foto escolhida';
      previa.appendChild(img);
    }
  }

  function salvarItem(e) {
    e.preventDefault();

    var nome = $('itemNome').value.trim();
    var preco = parseFloat($('itemPreco').value);

    if (!nome) {
      recado('itemAviso', 'erro', 'O caldo precisa de um nome.');
      return;
    }
    if (!isFinite(preco) || preco <= 0) {
      recado('itemAviso', 'erro', 'Coloque um preço maior que zero.');
      return;
    }

    var item = {
      id: $('itemId').value || '',
      nome: nome,
      preco: preco,
      descricao: $('itemSemDescricao').checked
        ? ''
        : $('itemDescricao').value.trim(),
      foto: estado.fotoAtual,
      ativo: $('itemAtivo').checked,
    };

    var editando = !!item.id;
    var botao = $('botaoSalvarItem');
    botao.disabled = true;
    botao.textContent = 'Salvando…';

    window.Dados.salvarItem(item)
      .then(function () {
        limparFormItem();
        recadoTemporario(
          'itemAviso',
          'ok',
          editando ? 'Item atualizado.' : '"' + nome + '" entrou no cardápio.'
        );
        carregar();
      })
      .catch(function (erro) {
        recado('itemAviso', 'erro', mensagemDeErro(erro));
      })
      .then(function () {
        botao.disabled = false;
        botao.textContent = 'Salvar no cardápio';
      });
  }

  function limparFormItem() {
    $('itemId').value = '';
    $('itemNome').value = '';
    $('itemPreco').value = '';
    $('itemDescricao').value = '';
    $('itemDescricao').disabled = false;
    $('itemSemDescricao').checked = false;
    $('itemAtivo').checked = true;
    estado.fotoAtual = '';
    pintarPrevia();
    contarLetras();
    recado('itemAviso', 'erro', '');
    $('tituloFormItem').textContent = 'Adicionar um caldo ao cardápio';
    $('subtituloFormItem').textContent =
      'Preencha o nome e o preço. A foto e a descrição são opcionais.';
    $('botaoCancelarEdicao').classList.add('escondido');
  }

  function editarItem(item) {
    $('itemId').value = item.id;
    $('itemNome').value = item.nome;
    $('itemPreco').value = item.preco;
    $('itemDescricao').value = item.descricao;
    $('itemSemDescricao').checked = !item.descricao;
    $('itemDescricao').disabled = !item.descricao;
    $('itemAtivo').checked = item.ativo;
    estado.fotoAtual = item.foto;
    pintarPrevia();
    contarLetras();
    recado('itemAviso', 'erro', '');
    $('tituloFormItem').textContent = 'Editando: ' + item.nome;
    $('subtituloFormItem').textContent =
      'Mude o que precisar e clique em salvar. Nada muda até você salvar.';
    $('botaoCancelarEdicao').classList.remove('escondido');
    $('formItem').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('itemNome').focus();
  }

  /* --------------------------------------------------------- lista de itens */

  function pintarLista() {
    var lista = $('listaItens');
    lista.textContent = '';

    var total = estado.itens.length;
    var ativos = estado.itens.filter(function (x) {
      return x.ativo;
    }).length;

    $('resumoItens').textContent = total
      ? total +
        (total === 1 ? ' caldo cadastrado' : ' caldos cadastrados') +
        ' · ' +
        ativos +
        ' à venda agora'
      : 'Nenhum caldo cadastrado ainda. Use o formulário acima para começar.';

    estado.itens.forEach(function (item, indice) {
      lista.appendChild(linhaDoItem(item, indice));
    });
  }

  function linhaDoItem(item, indice) {
    var el = criar(
      'div',
      'item-admin' + (item.ativo ? '' : ' item-admin--inativo')
    );

    var foto = criar(
      'div',
      'item-admin__foto' + (item.foto ? '' : ' item-admin__foto--vazia')
    );
    if (item.foto) {
      var img = criar('img');
      img.src = item.foto;
      img.alt = '';
      foto.appendChild(img);
    }
    el.appendChild(foto);

    var corpo = criar('div');

    var topo = criar('div', 'item-admin__topo');
    topo.appendChild(criar('span', 'item-admin__nome', item.nome));
    topo.appendChild(
      criar('span', 'item-admin__preco', dinheiro.format(item.preco))
    );
    if (!item.ativo) {
      topo.appendChild(criar('span', 'etiqueta etiqueta--esgotado', 'esgotado'));
    }
    corpo.appendChild(topo);

    var descricao = criar('p', 'item-admin__descricao');
    if (item.descricao) {
      descricao.textContent = item.descricao;
    } else {
      descricao.appendChild(criar('em', null, 'sem descrição'));
    }
    corpo.appendChild(descricao);

    var acoes = criar('div', 'item-admin__acoes');

    var editar = criar('button', 'botao botao--contorno botao--pequeno', 'Editar');
    editar.type = 'button';
    editar.addEventListener('click', function () {
      editarItem(item);
    });
    acoes.appendChild(editar);

    var alternar = criar(
      'button',
      'botao botao--neutro botao--pequeno',
      item.ativo ? 'Marcar esgotado' : 'Voltar a vender'
    );
    alternar.type = 'button';
    alternar.addEventListener('click', function () {
      alternar.disabled = true;
      window.Dados.alternarAtivo(item.id)
        .then(carregar)
        .catch(function (erro) {
          recado('painelAviso', 'erro', mensagemDeErro(erro));
          alternar.disabled = false;
        });
    });
    acoes.appendChild(alternar);

    var setas = criar('div', 'setas');
    [-1, 1].forEach(function (direcao) {
      var seta = criar('button', 'seta', direcao < 0 ? '↑' : '↓');
      seta.type = 'button';
      seta.title = direcao < 0 ? 'Subir no cardápio' : 'Descer no cardápio';
      seta.setAttribute(
        'aria-label',
        (direcao < 0 ? 'Subir ' : 'Descer ') + item.nome
      );
      seta.disabled =
        direcao < 0 ? indice === 0 : indice === estado.itens.length - 1;
      seta.addEventListener('click', function () {
        seta.disabled = true;
        window.Dados.mover(item.id, direcao)
          .then(carregar)
          .catch(function (erro) {
            recado('painelAviso', 'erro', mensagemDeErro(erro));
          });
      });
      setas.appendChild(seta);
    });
    acoes.appendChild(setas);

    var excluir = criar('button', 'botao botao--perigo botao--pequeno', 'Excluir');
    excluir.type = 'button';
    excluir.addEventListener('click', function () {
      var certeza = window.confirm(
        'Excluir "' + item.nome + '" do cardápio?\n\n' +
          'Isso não tem volta. Se for só por hoje, use "Marcar esgotado".'
      );
      if (!certeza) return;
      excluir.disabled = true;
      window.Dados.excluirItem(item.id)
        .then(function () {
          if ($('itemId').value === item.id) limparFormItem();
          carregar();
        })
        .catch(function (erro) {
          recado('painelAviso', 'erro', mensagemDeErro(erro));
          excluir.disabled = false;
        });
    });
    acoes.appendChild(excluir);

    corpo.appendChild(acoes);
    el.appendChild(corpo);
    return el;
  }

  /* --------------------------------------------------- formulario da loja */

  function preencherFormLoja() {
    var l = estado.loja;
    $('lojaNome').value = l.nome;
    $('lojaWhatsapp').value = formatarWhatsapp(l.whatsapp);
    $('lojaTaxa').value = l.taxaEntrega ? l.taxaEntrega : 0;
    $('lojaHorario').value = l.horario;
    $('lojaArea').value = l.areaEntrega;
    $('lojaBannerTitulo').value = l.bannerTitulo;
    $('lojaBannerTexto').value = l.bannerTexto;
  }

  function ligarFormLoja() {
    $('formLoja').addEventListener('submit', function (e) {
      e.preventDefault();

      var whatsapp = normalizarWhatsapp($('lojaWhatsapp').value);
      if (whatsapp.length < 12 || whatsapp.length > 15) {
        recado(
          'lojaAviso',
          'erro',
          'Confira o WhatsApp: use DDD + número, por exemplo 11 99999-9999.'
        );
        return;
      }

      var loja = {
        nome: $('lojaNome').value.trim(),
        whatsapp: whatsapp,
        taxaEntrega: parseFloat($('lojaTaxa').value) || 0,
        horario: $('lojaHorario').value.trim(),
        areaEntrega: $('lojaArea').value.trim(),
        bannerTitulo: $('lojaBannerTitulo').value.trim(),
        bannerTexto: $('lojaBannerTexto').value.trim(),
      };

      if (!loja.nome) {
        recado('lojaAviso', 'erro', 'A loja precisa de um nome.');
        return;
      }

      var botao = $('botaoSalvarLoja');
      botao.disabled = true;
      botao.textContent = 'Salvando…';

      window.Dados.salvarLoja(loja)
        .then(function (salva) {
          estado.loja = salva;
          preencherFormLoja();
          recadoTemporario('lojaAviso', 'ok', 'Dados da loja atualizados.');
        })
        .catch(function (erro) {
          recado('lojaAviso', 'erro', mensagemDeErro(erro));
        })
        .then(function () {
          botao.disabled = false;
          botao.textContent = 'Salvar dados da loja';
        });
    });
  }

  /* ------------------------------------------------------------- extras */

  function ligarExtras() {
    $('botaoExportar').addEventListener('click', function () {
      window.Dados.exportar()
        .then(function (json) {
          var hoje = new Date().toISOString().slice(0, 10);
          baixarArquivo('cardapio-' + hoje + '.json', json, 'application/json');
          recadoTemporario('backupAviso', 'ok', 'Cópia baixada.');
        })
        .catch(function (erro) {
          recado('backupAviso', 'erro', mensagemDeErro(erro));
        });
    });

    $('botaoImportar').addEventListener('click', function () {
      $('arquivoBackup').click();
    });

    $('arquivoBackup').addEventListener('change', function () {
      var arquivo = this.files && this.files[0];
      this.value = '';
      if (!arquivo) return;

      var certeza = window.confirm(
        'Restaurar vai substituir o cardápio atual pelo do arquivo.\n\nContinuar?'
      );
      if (!certeza) return;

      var leitor = new FileReader();
      leitor.onerror = function () {
        recado('backupAviso', 'erro', 'Não consegui ler esse arquivo.');
      };
      leitor.onload = function () {
        window.Dados.importar(leitor.result)
          .then(function () {
            recadoTemporario('backupAviso', 'ok', 'Cardápio restaurado.');
            limparFormItem();
            carregar();
          })
          .catch(function (erro) {
            recado('backupAviso', 'erro', mensagemDeErro(erro));
          });
      };
      leitor.readAsText(arquivo);
    });

    $('botaoGerarSenha').addEventListener('click', function () {
      var nova = $('novaSenha').value;
      if (nova.length < 6) {
        recado(
          'senhaAviso',
          'erro',
          'Use pelo menos 6 caracteres para a nova senha.'
        );
        return;
      }
      window.Dados.hashDeSenha(nova).then(function (hash) {
        if (!hash) {
          recado(
            'senhaAviso',
            'erro',
            'Para gerar a senha, abra o painel por um endereço http:// ou ' +
              'https:// (não direto do arquivo).'
          );
          return;
        }
        var caixa = $('senhaAviso');
        caixa.textContent = '';
        caixa.appendChild(
          criar(
            'div',
            'aviso aviso--ok',
            'Pronto! Abra o arquivo js/config.js, troque a linha ' +
              'senhaAdminHash pela linha abaixo, salve e publique de novo.'
          )
        );
        caixa.appendChild(criar('code', 'codigo', "  senhaAdminHash: '" + hash + "',"));
        $('novaSenha').value = '';
      });
    });
  }

  /* ---------------------------------------------------------- inicio */

  function iniciar() {
    prepararEntrada();
    // Quem ja entrou nesta aba (ou tem sessao do Supabase) vai direto.
    window.Dados.estaLogado().then(function (logado) {
      if (logado) abrirPainel();
      else $('senha').focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
