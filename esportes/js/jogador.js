/* =====================================================================
   PAGINA DE DETALHES DO JOGADOR

   Uma observacao honesta sobre os dados: a TheSportsDB e um banco de
   FICHAS, nao de estatisticas de desempenho. Ela tem altura, posicao,
   nacionalidade e descricao, mas nao tem gols na temporada, assistencia
   ou minutos jogados na chave gratuita.

   Entao esta pagina mostra o que a API realmente devolve, e diz
   claramente o que nao existe — em vez de inventar numeros.
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
      U.limpar(conteudo);
      conteudo.appendChild(U.vazio('Nenhum jogador escolhido.', 'Abra a página de um time e clique em um nome do elenco.'));
      return;
    }

    carregar(id);
  }

  function carregar(id) {
    U.limpar(conteudo);
    conteudo.appendChild(criar('div.esqueleto.esqueleto-alto'));

    Api.jogador(id)
      .then(function (r) {
        if (!r.dados) throw new Api.ErroApi('Jogador não encontrado.', 'formato');

        var j = r.dados;
        document.title = j.nome + ' — Placar Analítico';

        U.limpar(conteudo);
        conteudo.appendChild(perfil(j));

        var colunas = criar('div.duas-colunas');
        colunas.appendChild(painelPessoal(j));
        colunas.appendChild(painelCarreira(j));
        conteudo.appendChild(colunas);

        if (j.descricao) conteudo.appendChild(painelBio(j));

        conteudo.appendChild(avisoEstatisticas());

        if (j.idTime) carregarTime(j);
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

  function perfil(j) {
    var caixa = criar('div.perfil');
    caixa.appendChild(U.escudo(j.foto, j.nome, 92));

    var texto = criar('div');
    texto.style.minWidth = '0';
    texto.appendChild(criar('h1.perfil-nome', j.nome));

    var sub = [U.traduzirPosicao(j.posicao), j.time]
      .filter(Boolean)
      .join(' · ');
    if (sub) texto.appendChild(criar('p.perfil-sub', sub));

    var tags = criar('div.perfil-tags');
    if (j.numero) tags.appendChild(criar('span.tag', 'Camisa ' + j.numero));
    if (j.nacionalidade) tags.appendChild(criar('span.tag', j.nacionalidade));
    if (j.esporte) tags.appendChild(criar('span.tag', j.esporte));
    var idade = calcularIdade(j.nascimento);
    if (idade) tags.appendChild(criar('span.tag', idade + ' anos'));
    if (j.status && j.status.toLowerCase() !== 'active') tags.appendChild(criar('span.tag', j.status));
    texto.appendChild(tags);

    caixa.appendChild(texto);
    return caixa;
  }

  /* ================================================================
     PAINEIS
     ================================================================ */

  function painelPessoal(j) {
    var p = criar('div.painel');
    p.appendChild(criar('h2.painel-titulo', 'Dados pessoais'));

    [
      ['Nascimento', formatarNascimento(j.nascimento)],
      ['Naturalidade', j.naturalidade],
      ['Nacionalidade', j.nacionalidade],
      ['Altura', j.altura],
      ['Peso', j.peso],
      ['Gênero', j.genero === 'Male' ? 'Masculino' : j.genero === 'Female' ? 'Feminino' : j.genero],
    ].forEach(function (par) {
      var l = U.linhaDado(par[0], par[1]);
      if (l) p.appendChild(l);
    });

    if (p.children.length === 1) {
      p.appendChild(criar('p.estado-texto', 'A API não trouxe dados pessoais para este jogador.'));
    }

    return p;
  }

  function painelCarreira(j) {
    var p = criar('div.painel');
    p.appendChild(criar('h2.painel-titulo', 'Carreira'));

    [
      ['Clube atual', j.time],
      ['Posição', U.traduzirPosicao(j.posicao)],
      ['Camisa', j.numero],
      ['Contratado em', j.assinatura],
      ['Salário informado', j.salario],
      ['Lado preferido', j.lado],
      ['Situação', j.status],
    ].forEach(function (par) {
      var l = U.linhaDado(par[0], par[1]);
      if (l) p.appendChild(l);
    });

    if (p.children.length === 1) {
      p.appendChild(criar('p.estado-texto', 'A API não trouxe dados de carreira para este jogador.'));
    }

    return p;
  }

  function painelBio(j) {
    var s = criar('section.secao');
    var p = criar('div.painel');
    p.appendChild(criar('h2.painel-titulo', 'Biografia'));
    var texto = criar('p.rodape-texto', j.descricao);
    texto.style.fontSize = '13.5px';
    p.appendChild(texto);
    s.appendChild(p);
    return s;
  }

  /**
   * Nao esconder a limitacao: e melhor o usuario saber que a fonte nao
   * tem os numeros do que achar que o site esta quebrado.
   */
  function avisoEstatisticas() {
    var s = criar('section.secao');
    var aviso = criar('div.aviso-modelo');

    aviso.appendChild(criar('h3', 'Sobre as estatísticas de desempenho'));
    aviso.appendChild(
      criar(
        'p',
        'A TheSportsDB é um banco de fichas: ela catáloga quem é o jogador, mas não ' +
          'publica gols na temporada, assistências, minutos em campo ou cartões na chave gratuita. ' +
          'Por isso esta página mostra apenas o que existe de fato na fonte.'
      )
    );
    aviso.appendChild(
      criar(
        'p',
        'A análise de partidas do site funciona por equipe, não por jogador — os dados de ' +
          'resultado e placar estão disponíveis e são confiáveis. Se você precisar de ' +
          'números individuais no futuro, será necessária outra fonte de dados.'
      )
    );

    s.appendChild(aviso);
    return s;
  }

  /* ================================================================
     TIME DO JOGADOR
     ================================================================ */

  function carregarTime(j) {
    var s = criar('section.secao');
    conteudo.appendChild(s);

    Api.time(j.idTime)
      .then(function (r) {
        if (!r.dados) return;

        s.appendChild(U.secao('Clube'));

        var p = criar('div.painel');
        var link = criar('a.jogador-item', { href: 'time.html?id=' + encodeURIComponent(r.dados.id) });
        link.appendChild(U.escudo(r.dados.escudo, r.dados.nome, 44));

        var texto = criar('div');
        texto.style.minWidth = '0';
        texto.appendChild(criar('div.jogador-nome', r.dados.nome));
        texto.appendChild(criar('div.jogador-pos', [r.dados.liga, r.dados.pais].filter(Boolean).join(' · ')));
        link.appendChild(texto);

        p.appendChild(link);
        s.appendChild(p);
      })
      .catch(function () {
        /* Sem o clube a pagina continua util. */
      });
  }

  /* ================================================================
     AUXILIARES
     ================================================================ */

  function calcularIdade(nascimento) {
    if (!nascimento) return null;
    var d = new Date(nascimento);
    if (isNaN(d.getTime())) return null;

    var hoje = new Date();
    var idade = hoje.getFullYear() - d.getFullYear();
    var m = hoje.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;

    return idade > 0 && idade < 120 ? idade : null;
  }

  function formatarNascimento(n) {
    if (!n) return null;
    var d = new Date(n);
    if (isNaN(d.getTime())) return n;
    return U.formatarData(d) + '/' + d.getUTCFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);
