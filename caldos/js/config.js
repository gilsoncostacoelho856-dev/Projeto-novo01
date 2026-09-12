/* =====================================================================
   CONFIGURACAO DO SITE  —  o unico arquivo que voce precisa editar
   =====================================================================

   1) SENHA DO PAINEL
      A senha nao fica escrita aqui: fica guardada a "impressao digital"
      dela (hash SHA-256), que nao pode ser lida de volta. A senha e a que
      voce escolheu — ela nao aparece em nenhum arquivo do projeto.

      Para trocar, abra o painel (admin.html), entre com a senha atual e
      use o botao "Trocar senha do painel" — ele gera a nova linha
      `senhaAdminHash` pronta para colar aqui embaixo.

   2) MODO NUVEM (opcional, mas recomendado)
      Sem preencher `supabase`, o site roda em MODO LOCAL: tudo fica
      salvo no navegador de quem edita. Otimo para testar, mas o cardapio
      NAO aparece para os clientes em outros celulares.

      Preenchendo `url` e `anonKey`, o site passa a usar o MODO NUVEM: o
      cardapio fica num banco de dados e toda mudanca no painel aparece
      na hora para todos os clientes. O passo a passo esta no LEIA-ME.md.

   ===================================================================== */

window.CALDOS_CONFIG = {
  // Impressao digital (SHA-256) da senha do painel.
  senhaAdminHash:
    '8dfe283fdb2367474a074c8c1e25ae2ab239e9d246066882d3996785d93a13f5',

  // Modo nuvem (Supabase). Deixe as duas linhas vazias para o modo local.
  // Use SEMPRE a chave "anon / publishable" — nunca a `service_role`.
  supabase: {
    url: '',
    anonKey: '',
  },

  // Conteudo inicial: e o que aparece na primeira vez, antes de voce
  // cadastrar seus proprios caldos pelo painel.
  padrao: {
    loja: {
      nome: 'GN CALDOS',
      bannerTitulo: 'Caldo quentinho na sua porta',
      bannerTexto:
        'Feito na hora, com tempero de casa. Peça pelo WhatsApp e receba em minutos.',
      whatsapp: '5599992289542',
      horario: 'Terça a domingo, das 18h às 23h30',
      areaEntrega: 'Entregamos no Centro, Jardim das Flores e Vila Nova',
      taxaEntrega: 0,
    },
    itens: [
      {
        id: 'exemplo-1',
        nome: 'Caldo de mandioca com carne seca',
        preco: 18.9,
        descricao:
          'Mandioca cremosa batida na hora com carne seca desfiada e cheiro-verde.',
        foto: '',
        ativo: true,
        ordem: 1,
      },
      {
        id: 'exemplo-2',
        nome: 'Caldo verde português',
        preco: 17.5,
        descricao: 'Batata, couve fatiada fina e rodelas de calabresa.',
        foto: '',
        ativo: true,
        ordem: 2,
      },
      {
        id: 'exemplo-3',
        nome: 'Canja de galinha',
        preco: 16.0,
        descricao: 'Arroz, frango desfiado e legumes. A que cura tudo.',
        foto: '',
        ativo: true,
        ordem: 3,
      },
    ],
  },
};
