# GN CALDOS — site de delivery

Site pronto para publicar, em duas partes:

| Parte | Arquivo | Para quem |
|---|---|---|
| **Cardápio e carrinho** | `index.html` | seus clientes |
| **Painel de administração** | `admin.html` | só você, com senha |

Tudo que você muda no painel aparece na página do cliente. Não precisa mexer
em código para trocar preço, foto, horário ou número de WhatsApp.

---

## 1. Ver o site agora, no seu computador

Não precisa instalar nada. Abra a pasta `caldos` e dê dois cliques em
`index.html`.

Para o painel funcionar 100% (inclusive o botão de trocar senha), abra por um
endereço `http://` em vez do arquivo direto. Dentro da pasta `caldos`, rode:

```bash
python3 -m http.server 8000
```

E abra no navegador:

- Cardápio: <http://localhost:8000/index.html>
- Painel: <http://localhost:8000/admin.html>

---

## 2. Como entrar no painel

1. Abra **`/admin`** no fim do endereço do site
   (ex.: `https://gn-caldos.vercel.app/admin`).
   Também funciona `/admin.html`.
2. Digite a senha que você escolheu.
3. Pronto. O painel tem três abas:

| Aba | O que você faz |
|---|---|
| 🍲 **Cardápio** | Adicionar caldo, editar nome/preço/descrição, trocar foto, marcar "esgotado hoje", subir/descer na ordem, excluir |
| 🏠 **Minha loja** | Nome do delivery, WhatsApp, horário, área de entrega, taxa de entrega e os textos do banner |
| 🔐 **Backup e senha** | Baixar uma cópia do cardápio, restaurar de um arquivo e trocar a senha |

Detalhes que ajudam no dia a dia:

- **Foto**: o botão "Escolher foto" abre a câmera ou a galeria do celular. A
  imagem é reduzida sozinha antes de salvar — não precisa se preocupar com o
  tamanho.
- **Sem descrição**: marque a caixinha e o caldo aparece só com nome, foto e
  preço.
- **Esgotou hoje?** Use **"Marcar esgotado"**, não "Excluir". O caldo continua
  cadastrado, aparece no site com a faixa *Esgotado hoje* e não pode ser
  adicionado ao carrinho. Amanhã você clica em "Voltar a vender".
- **Excluir** apaga de verdade e não tem volta.
- A senha **não está guardada em nenhum arquivo** — só a "impressão digital"
  dela. Para trocar, use o botão na aba 🔐: ele te dá uma linha para colar no
  arquivo `js/config.js`.

---

## 3. Ligar o modo nuvem (faça isso antes de divulgar o site)

Neste momento o site está em **modo local**: o cardápio que você editar fica
salvo só no navegador do seu aparelho. Para testar é ótimo, mas **um cliente
abrindo no celular dele não veria as suas mudanças**.

O modo nuvem resolve isso: o cardápio vai para um banco de dados e toda mudança
aparece na hora para todo mundo. É gratuito e se faz uma vez só.

### 3.1 Criar o banco

1. Entre em <https://supabase.com> e crie uma conta (pode entrar com o GitHub).
2. Clique em **New project**. Dê um nome (ex.: `gn-caldos`), escolha uma senha
   de banco (guarde-a) e a região **South America (São Paulo)**. Espere uns 2
   minutos.
3. No menu da esquerda, abra **SQL Editor** → **New query**.
4. Abra o arquivo `supabase-schema.sql` desta pasta, copie **tudo**, cole ali e
   clique em **Run**. Deve aparecer *Success*.

### 3.2 Criar o seu usuário de administrador

1. Menu da esquerda → **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Coloque o seu e-mail e a **mesma senha** que você já usa no painel.
3. Marque **Auto Confirm User** e confirme.

**Agora o passo mais importante:** ainda em **Authentication**, vá em
**Sign In / Providers** (ou *Settings*) e **desligue** a opção que permite
novos cadastros (*Allow new users to sign up* / *Enable sign ups*).

Sem isso, qualquer pessoa poderia criar uma conta e editar o seu cardápio,
porque a regra do banco é "quem está logado pode escrever". Com os cadastros
desligados, só o seu usuário existe.

### 3.3 Apontar o site para o banco

1. Menu da esquerda → **Project Settings** → **API**.
2. Copie o **Project URL** e a chave **anon / public**.
3. Abra o arquivo `js/config.js` e preencha só estas duas linhas:

```js
  supabase: {
    url: 'https://xxxxxxxxxxxx.supabase.co',
    anonKey: 'eyJhbGciOi..... (chave bem comprida)',
  },
```

> Use **apenas** a chave `anon / public`. A chave `service_role` nunca pode
> entrar neste arquivo — ela dá acesso total ao banco e o arquivo fica visível
> para qualquer visitante.

4. Salve e publique de novo. A partir daí o painel pede **e-mail + senha** (a
   conta que você criou no passo 3.2) e a etiqueta no topo do painel muda de
   *só neste aparelho* para **nuvem**.

Se você já cadastrou caldos no modo local e não quer perdê-los: antes de ligar
a nuvem, vá na aba 🔐 e clique em **"Baixar cópia do cardápio"**. Depois de
ligar a nuvem, entre no painel e use **"Restaurar de um arquivo"**.

---

## 4. Publicar na Vercel

O site é feito de arquivos estáticos — não tem build, não tem servidor.

> ⚠️ Este repositório tem **dois projetos**: o aplicativo de finanças na raiz e
> este site na pasta `caldos`. Por isso, na Vercel, crie um projeto **novo** e
> aponte a pasta certa — senão a Vercel tenta publicar o app de finanças.

1. Entre em <https://vercel.com> com a sua conta do GitHub.
2. **Add New** → **Project** → escolha o repositório `projeto-novo01`.
3. Em **Framework Preset**, escolha **Other**.
4. Em **Root Directory**, clique em *Edit* e selecione a pasta **`caldos`**.
   Esse é o passo que não pode faltar.
5. Deixe *Build Command* e *Install Command* **vazios**.
6. Clique em **Deploy**.

Em menos de um minuto você recebe um endereço tipo
`https://gn-caldos.vercel.app`. O cardápio fica na raiz e o painel em `/admin`.

Cada vez que você enviar uma mudança para o GitHub, a Vercel republica sozinha.

**Domínio próprio** (ex.: `gncaldos.com.br`): no projeto, **Settings** →
**Domains** → *Add*, e siga as instruções para apontar o domínio.

### Outras opções de hospedagem

- **Netlify**: entre em <https://app.netlify.com/drop> e arraste a pasta
  `caldos` para a página. O site fica no ar na hora.
- **GitHub Pages**: em **Settings** → **Pages** do repositório, publique a
  branch. Como o Pages serve o repositório inteiro, o site fica em
  `.../caldos/` e o painel em `.../caldos/admin.html`.

---

## 5. O que tem dentro da pasta

```
caldos/
├── index.html            página do cliente (cardápio + carrinho)
├── admin.html            painel de administração
├── vercel.json           faz o /admin funcionar sem o ".html"
├── supabase-schema.sql   o banco de dados do modo nuvem
├── css/
│   └── estilos.css       todo o visual
└── js/
    ├── config.js         ⬅ o único arquivo que você edita à mão
    ├── dados.js          salva e lê os dados (local ou nuvem)
    ├── loja.js           cardápio, carrinho e mensagem do WhatsApp
    └── admin.js          o painel
```

---

## 6. Como o pedido chega para você

O cliente monta o carrinho e clica em **Finalizar pedido no WhatsApp**. Abre o
WhatsApp dele com a mensagem já escrita, no seu número:

```
*Novo pedido — GN CALDOS*

• 2x Caldo de mandioca com carne seca — R$ 37,80
• 1x Canja de galinha — R$ 16,00

Subtotal: R$ 53,80
Taxa de entrega: R$ 5,00
*Total: R$ 58,80*

Nome: Maria
Endereço: Rua das Flores, 10
```

Nome e endereço são campos opcionais no carrinho: se o cliente preencher, vêm
na mensagem; se não, você pergunta na conversa.

O site **não cobra nem processa pagamento** — o combinado de pagamento e
entrega acontece na conversa do WhatsApp, como já funciona hoje.

---

## 7. Duas coisas que vale saber

**A senha do painel protege contra curioso, não contra especialista.** No modo
local, a verificação acontece no próprio navegador: alguém que saiba mexer no
código-fonte da página consegue passar por ela. Nada de grave acontece — no
máximo essa pessoa mexeria no cardápio salvo no *próprio* navegador dela, sem
afetar o seu site nem os seus clientes.

**No modo nuvem a proteção é de verdade**, porque quem guarda os dados é o
banco: a regra é *qualquer um lê, só quem está logado escreve*, e isso é
verificado no servidor do Supabase, não no navegador. É por isso que desligar
os novos cadastros (passo 3.2) importa tanto.

---

## 8. Se algo der errado

| Problema | O que fazer |
|---|---|
| O painel diz "permission denied for table" | O SQL não rodou até o fim. Rode `supabase-schema.sql` de novo, inteiro. |
| "E-mail ou senha não conferem" | Confirme que criou o usuário em *Authentication → Users* e marcou *Auto Confirm User*. |
| Editei no painel e o cliente não vê | Você está em modo local. Veja a etiqueta no topo do painel: se disser *só neste aparelho*, faça o passo 3. |
| A foto não aparece no modo nuvem | O balde `fotos` não foi criado. O SQL do passo 3.1 cria; rode de novo. |
| "O navegador ficou sem espaço" | Só acontece no modo local, onde as fotos ficam no navegador. É o sinal de que já passou da hora de ligar o modo nuvem. |
| Publiquei na Vercel e apareceu o app de finanças | O **Root Directory** não foi apontado para `caldos`. Ajuste em *Settings → General*. |
