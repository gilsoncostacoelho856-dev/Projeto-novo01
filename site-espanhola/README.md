# Site do Bar & Pizzaria da Espanhola

Site de uma página só, feito em HTML, CSS e JavaScript puros — **sem framework,
sem banco de dados e sem custo de servidor**. São três arquivos:

| Arquivo | O que é |
|---|---|
| `index.html` | O conteúdo: textos, cardápio, endereço, horários |
| `estilo.css` | As cores, as fontes e o layout |
| `script.js` | O menu do celular, as abas do cardápio e o aviso de *aberto/fechado* |

O que já está pronto: capa com a nota do Google, cardápio em abas
(pizzas, porções, bebidas), seção "a casa", tabela de horários que **marca o dia
de hoje**, mapa do Google embutido, botão flutuante de WhatsApp, e os dados
estruturados que o Google usa para mostrar endereço e horário na busca.

---

## 1. Ver o site no seu computador

Basta **abrir o `index.html`** com um duplo clique — ele funciona direto do
arquivo, sem instalar nada.

Se preferir servir como um site de verdade (recomendado, evita bloqueios do
navegador):

```bash
cd site-espanhola
python3 -m http.server 8000
# abra http://localhost:8000
```

---

## 2. O que você PRECISA trocar antes de publicar

Procure os comentários `EDITE AQUI` nos arquivos. Em resumo:

- **Telefone e WhatsApp** — `index.html` tem `5599900000000` em 4 lugares
  (menu, capa, botão flutuante, "Ligar") e no bloco de dados estruturados lá no
  fim. O formato do WhatsApp é `55` + DDD + número, tudo junto e sem símbolos:
  `wa.me/5599912345678`.
- **Preços e itens do cardápio** — os valores atuais são exemplos. Cada prato é
  um bloco `<li class="item">`; copie um para criar outro, apague um para
  removê-lo.
- **Horários** — se mudar a tabela do `index.html`, mude também a lista
  `HORARIOS` no topo do `script.js`, senão o aviso de "aberto agora" fica
  errado. Para fechar num dia, use `null` (ex.: `1: null` fecha a segunda).
- **Instagram** — link no rodapé.
- **Mapa** — o mapa atual aponta para a rua. Para deixá-lo no ponto exato:
  Google Maps → procure a pizzaria → *Compartilhar* → *Incorporar um mapa* →
  copie o `src` do iframe e cole no `index.html`.
- **Fotos** — o site já fica de pé sem nenhuma foto (a pizza da capa é
  desenhada em CSS). Se tiver fotos boas do salão e das pizzas, crie a pasta
  `imagens/` e troque a arte da capa por um `<img>`. Fotos ruins pioram o
  site — melhor nenhuma do que uma escura e tremida.

---

## 3. Publicar de graça no GitHub Pages

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em *Source*, escolha **Deploy from a branch**.
3. Escolha a branch (`main`) e a pasta **`/ (root)`**, e salve.
4. Em um ou dois minutos o site fica no ar em
   `https://<seu-usuario>.github.io/<repositorio>/site-espanhola/`.

> Se quiser o endereço sem o `/site-espanhola` no fim, mova os três arquivos
> para a raiz do repositório — ou crie um repositório só para o site.

**Alternativas igualmente gratuitas:** arraste a pasta `site-espanhola` para o
[app.netlify.com/drop](https://app.netlify.com/drop) e o site sobe na hora, ou
use a [Vercel](https://vercel.com). Nenhuma delas cobra para um site deste
tamanho.

### Domínio próprio (opcional)

`espanholagrajau.com.br` custa cerca de R$ 40 por ano no
[registro.br](https://registro.br). Depois de comprar, aponte-o para o GitHub
Pages ou a Netlify (as duas têm a instrução pronta em *Custom domain*) — o
certificado HTTPS é gratuito e automático.

---

## 4. Colocar o link no Google Maps

É isso que faz o botão **Site** da sua ficha funcionar:

1. Instale o app **Google Maps** e entre com a conta dona do estabelecimento.
2. Abra o perfil da empresa → *Editar perfil* → *Informações de contato*.
3. Cole o endereço do site em **Site** e salve.

Se o perfil ainda não for seu, use *Reivindicar esta empresa* na própria ficha —
o Google confirma por telefone ou carta e leva alguns dias.

---

## 5. Depois de publicar

- Mande o link no status do WhatsApp e na bio do Instagram.
- Atualize os preços aqui sempre que mudarem no balcão — um cardápio
  desatualizado gera discussão na entrega.
- A data em "Última atualização" no fim do cardápio existe para isso: mude-a
  junto com os preços.
