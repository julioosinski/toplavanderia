## Objetivo
Garantir que toda operação PIX (Cielo Smart POS, PayGO terminal, QR PayGO) gere uma linha em `public.transactions` com `payment_method='pix'` e termine em `status='completed'`, refletindo nos relatórios.

## Etapa 1 — Investigação rápida (5 min)
- Consultar logs do `esp32-monitor` / `transaction-webhook` no último dia para ver se houve tentativa PIX que falhou na escrita.
- Confirmar com o usuário: a maquininha está rodando Cielo Smart POS (deep link) ou PayGO/PPC930? Isso decide qual caminho corrigir primeiro.

## Etapa 2 — Fechar o ciclo PIX (status='completed')
Hoje `create_totem_transaction` grava `status='pending'` e nada marca PIX como `completed`. Soluções (no mesmo PR):

1. Em `src/pages/Totem.tsx` `activateMachine`, **após** o ESP32 confirmar o relé ligado, fazer `UPDATE transactions SET status='completed', completed_at=now() WHERE id = transactionId`. Isso vale para todos os métodos, não só PIX, e corrige também os 14 `credit pending` antigos por idempotência futura.
2. Manter o trigger `update_machine_stats` (já soma revenue/uses quando vira `completed`).

## Etapa 3 — Garantir gravação no caminho Cielo Deep Link
Problema: `CieloResponseActivity` (nativo) recebe o callback mas o JS pode não estar resolvendo a `Promise`.

Opções (escolher 1, ver pergunta abaixo):

- **A. Via JS (preferido):** Confirmar que `CieloLioManager.handleDeepLinkResponse(uri)` chama de volta o plugin Capacitor (`paygo` plugin) com o resultado, e que `processPaygoPayment` resolve com `success:true`. Se não, adicionar `notifyListeners('cieloResult', {...})` no plugin nativo e escutar no `useUniversalPayment` para resolver a promise pendente.
- **B. Via edge function:** `CieloResponseActivity` faz POST direto numa nova Edge Function `cielo-payment-callback` (com `verify_jwt=false`) que insere a transação `completed` no Supabase. Mais robusto se a app foi morta enquanto pagava.

## Etapa 4 — Rede de segurança (cron polling)
Criar `pg_cron` (ou job no `auto-release-machines`) que a cada 2 min:
- Procura `transactions` com `status='pending'` e `payment_method='pix'` criadas há > 3 min.
- Se houver `esp32_status.relay_status` indicando relé ligado para aquela máquina **ou** comando `pending_commands` executado com sucesso → marcar `completed`.
- Caso contrário, após 10 min → marcar `cancelled` para limpar relatório.

## Etapa 5 — Backfill (opcional)
Se o usuário tiver extrato Cielo das operações PIX já feitas, criar script SQL para inserir essas transações históricas em `transactions` como `completed` para os relatórios passados ficarem corretos.

## Arquivos afetados
- `src/pages/Totem.tsx` (Etapa 2)
- `src/hooks/useUniversalPayment.ts` ou `src/plugins/paygo.ts` + `CieloLioManager.java` (Etapa 3A) **ou** nova `supabase/functions/cielo-payment-callback/index.ts` + `CieloResponseActivity.java` (Etapa 3B)
- Nova migration `pg_cron` (Etapa 4)

## Detalhes técnicos
- O `payment_method` já é normalizado para `'pix'` por `normalizePaymentMethod` em `Totem.tsx:411`.
- A Etapa 2 (`UPDATE … completed`) já dispara o trigger `update_machine_stats` → revenue agrega sozinha.
- `LaundryReportsTab` continua sem mudanças — o problema é só de escrita.

## Atenção: requer rebuild do APK
As correções de Etapa 2 e 3 são código JS/Java → **a maquininha precisa de novo APK** (a menos que você ative `server.url` no `capacitor.config.ts` antes, o que tornaria a Etapa 2 instantânea). Edge Function (3B) e cron (4) entram sem rebuild.

## Perguntas antes de implementar
1. A maquininha hoje está em **Cielo Smart POS** (deep link Cielo LIO) ou **PayGO/PPC930**? (define Etapa 3)
2. Prefere caminho **A (corrigir bridge JS, depende de novo APK)** ou **B (Edge Function recebendo callback nativo, sobrevive a app morto)**?
3. Quer que eu rode a **Etapa 5 (backfill)** se você me passar o extrato Cielo dos PIX já feitos?
