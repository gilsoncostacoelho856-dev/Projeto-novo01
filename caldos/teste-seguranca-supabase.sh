#!/usr/bin/env bash
# =====================================================================
# Kit de teste de segurança do BACKEND (Supabase) — rode você mesmo
# ---------------------------------------------------------------------
# O ambiente onde o site foi construído nao tem acesso de rede ao
# Supabase, entao estes testes precisam ser rodados por voce, de um
# computador com internet. Eles NAO mudam nada no banco quando a
# seguranca esta correta: as tentativas de escrita devem ser RECUSADAS.
#
# Como usar:
#   1. salve este arquivo
#   2. rode:  bash teste-seguranca-supabase.sh
# =====================================================================
set -u

URL="https://prjxvskmsescbknujyly.supabase.co"
ANON="sb_publishable_fhAIjCEWjXRMOCjm-5-58g_RSt_UgN1"

echo "== 1. Ler o cardapio sem login (DEVE funcionar: 200) =="
curl -s -o /dev/null -w "  HTTP %{http_code}  (esperado 200)\n" \
  "$URL/rest/v1/itens?select=*" -H "apikey: $ANON"

echo
echo "== 2. INSERIR item sem login (DEVE ser recusado: 401 ou 403) =="
curl -s -o /dev/null -w "  HTTP %{http_code}  (esperado 401/403)\n" \
  -X POST "$URL/rest/v1/itens" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"id":"hack-test","nome":"INVASOR","preco":0.01,"ordem":999}'

echo
echo "== 3. APAGAR um item sem login (DEVE ser recusado: 401 ou 403) =="
curl -s -o /dev/null -w "  HTTP %{http_code}  (esperado 401/403)\n" \
  -X DELETE "$URL/rest/v1/itens?id=eq.exemplo-1" -H "apikey: $ANON"

echo
echo "== 4. ALTERAR o WhatsApp da loja sem login (DEVE ser recusado) =="
curl -s -o /dev/null -w "  HTTP %{http_code}  (esperado 401/403)\n" \
  -X PATCH "$URL/rest/v1/loja?id=eq.1" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"whatsapp":"5500000000000"}'

echo
echo "== 5. CADASTRO aberto? Tentar criar uma conta nova =="
echo "   (se responder com um usuario/sessao, os cadastros estao ABERTOS — risco!)"
curl -s -o /dev/null -w "  HTTP %{http_code}  (200 = cadastro ABERTO e perigoso; 422/403/400 = fechado, bom)\n" \
  -X POST "$URL/auth/v1/signup" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"invasor-teste@exemplo.com","password":"SenhaQualquer123!"}'

echo
echo "== 6. Forca bruta no login (10 tentativas rapidas) =="
echo "   (o Supabase deve comecar a responder 429 = bloqueio por excesso)"
for i in $(seq 1 10); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
    -H "Content-Type: application/json" \
    -d '{"email":"gilsoncostacoelho856@gmail.com","password":"tentativa-errada-'$i'"}')
  echo "  tentativa $i: HTTP $code"
done

echo
echo "== Como ler o resultado =="
echo "  Tudo seguro se: teste 1 = 200; testes 2, 3, 4 = 401 ou 403;"
echo "  teste 5 = 422/400/403 (cadastro fechado); teste 6 termina em 429."
echo "  Se o teste 2, 3 ou 4 responder 200/201, a escrita esta LIBERADA -> PARE e me avise."
echo "  Se o teste 5 responder 200, DESLIGUE os cadastros antes de divulgar o site."
