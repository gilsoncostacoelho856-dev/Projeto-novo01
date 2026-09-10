/* =========================================================
   Bar & Pizzaria da Espanhola — comportamento da página
   Sem bibliotecas: é só este arquivo.
   ========================================================= */

/* ---------------------------------------------------------
   EDITE AQUI: horário de funcionamento.
   0 = domingo, 1 = segunda ... 6 = sábado.
   Use null no dia em que a casa não abre. Ex.: 1: null (fecha segunda).
   Quando "fecha" for menor que "abre", entende-se que vira o dia
   (18:00 – 02:00 = abre às 18h e fecha às 2h da manhã seguinte).
   Mudou aqui? Mude também a tabela de horários no index.html.
   --------------------------------------------------------- */
const HORARIOS = {
  0: { abre: "18:00", fecha: "00:00" }, // domingo
  1: { abre: "18:00", fecha: "00:00" }, // segunda
  2: { abre: "18:00", fecha: "00:00" }, // terça
  3: { abre: "18:00", fecha: "00:00" }, // quarta
  4: { abre: "18:00", fecha: "00:00" }, // quinta
  5: { abre: "18:00", fecha: "02:00" }, // sexta
  6: { abre: "18:00", fecha: "02:00" }, // sábado
};

const NOMES_DOS_DIAS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

/* ===================== menu do celular ===================== */

const menuBotao = document.getElementById("menuBotao");
const navegacao = document.getElementById("navegacao");

menuBotao?.addEventListener("click", () => {
  const aberto = navegacao.classList.toggle("aberto");
  menuBotao.setAttribute("aria-expanded", String(aberto));
});

// Ao clicar num link, fecha o menu (só faz diferença no celular).
navegacao?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navegacao.classList.remove("aberto");
    menuBotao.setAttribute("aria-expanded", "false");
  });
});

/* ===================== abas do cardápio ===================== */

const abas = Array.from(document.querySelectorAll('.abas [role="tab"]'));

function mostrarAba(aba) {
  abas.forEach((outra) => {
    const escolhida = outra === aba;
    outra.setAttribute("aria-selected", String(escolhida));
    document.getElementById(outra.getAttribute("aria-controls")).hidden = !escolhida;
  });
}

abas.forEach((aba, indice) => {
  aba.addEventListener("click", () => mostrarAba(aba));

  // Setas do teclado navegam entre as abas, como manda o padrão de acessibilidade.
  aba.addEventListener("keydown", (evento) => {
    const passo = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (!passo) return;
    evento.preventDefault();
    const proxima = abas[(indice + passo + abas.length) % abas.length];
    proxima.focus();
    mostrarAba(proxima);
  });
});

/* ===================== aberto ou fechado agora ===================== */

// "18:00" -> 1080 (minutos desde a meia-noite)
function emMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// Um dia que fecha à meia-noite ou depois "empresta" minutos do dia seguinte.
function fimDoExpediente(faixa) {
  const abre = emMinutos(faixa.abre);
  const fecha = emMinutos(faixa.fecha);
  return fecha <= abre ? fecha + 24 * 60 : fecha;
}

function situacao(agora) {
  const dia = agora.getDay();
  const minutoAtual = agora.getHours() * 60 + agora.getMinutes();

  // 1) A casa abriu ontem e ainda não fechou? (madrugada de sexta pra sábado, p. ex.)
  const ontem = HORARIOS[(dia + 6) % 7];
  if (ontem && fimDoExpediente(ontem) - 24 * 60 > minutoAtual) {
    return { aberto: true, fecha: ontem.fecha };
  }

  // 2) Abriu hoje e ainda está dentro do horário?
  const hoje = HORARIOS[dia];
  if (hoje && minutoAtual >= emMinutos(hoje.abre) && minutoAtual < fimDoExpediente(hoje)) {
    return { aberto: true, fecha: hoje.fecha };
  }

  // 3) Fechado: procura a próxima abertura, olhando até uma semana à frente.
  for (let adiante = 0; adiante < 8; adiante++) {
    const faixa = HORARIOS[(dia + adiante) % 7];
    if (!faixa) continue;
    if (adiante === 0 && minutoAtual >= emMinutos(faixa.abre)) continue;
    return {
      aberto: false,
      abre: faixa.abre,
      quando: adiante === 0 ? "hoje" : adiante === 1 ? "amanhã" : NOMES_DOS_DIAS[(dia + adiante) % 7],
    };
  }

  return null; // nenhum dia com horário cadastrado
}

function atualizarStatus() {
  const alvo = document.getElementById("statusAgora");
  if (!alvo) return;

  const estado = situacao(new Date());
  if (!estado) { alvo.hidden = true; return; }

  alvo.hidden = false;
  alvo.classList.toggle("aberto", estado.aberto);
  alvo.classList.toggle("fechado", !estado.aberto);
  alvo.textContent = estado.aberto
    ? `Aberto agora — até às ${estado.fecha}`
    : `Fechado agora — abre ${estado.quando} às ${estado.abre}`;
}

atualizarStatus();
setInterval(atualizarStatus, 60 * 1000); // reavalia a cada minuto

/* ===================== detalhes ===================== */

// Marca a linha de hoje na tabela de horários.
const linhaDeHoje = document.querySelector(`#tabelaHorarios [data-dia="${new Date().getDay()}"]`);
linhaDeHoje?.classList.add("hoje");

// Ano do rodapé, para não envelhecer sozinho.
const ano = document.getElementById("ano");
if (ano) ano.textContent = String(new Date().getFullYear());
