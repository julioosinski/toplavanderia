# Arquitetura de pagamentos — Top Lavanderia

## Objetivo

Evitar perda de pagamentos realizados no totem (Cielo LIO hoje; Stone POS na fase B), com sessão persistida, reserva atômica de máquina, reconciliação via Order Manager e liberação ESP idempotente.

**Pulso ESP32:** permanece **1000 ms** (`credit_pulse`) — sem alteração de firmware nesta fase.

---

## Fase A — Cielo (implementada)

| Componente | Responsabilidade |
|------------|------------------|
| `payment_sessions` | Máquina de estados do pagamento (fonte de verdade do fluxo) |
| `payment_terminals` | Registro de terminais (`cielo` \| `stone` \| `paygo`) |
| `begin_totem_payment_session` | Reserva atômica (`FOR UPDATE`) + TX `pending` + sessão `CREATED` |
| `update_payment_session` | Transições de estado + refs Cielo |
| `mark_totem_payment_authorized` | Metadata TX + sessão `AUTHORIZED` |
| `cancel_totem_transaction_by_id` | **Não cancela** se já autorizado → `RECONCILIATION_PENDING` |
| `enqueue_totem_machine_release` | Reenfileira ON/crédito idempotente (reconcile/cron/admin) |
| `list_orphan_totem_releases` | TX pagas sem comando ESP `completed` |
| Edge `reconcile-payments` | Cron: consulta Cielo OM, autoriza tardios, reenfileira liberação |
| Admin `PaymentDiagnosticsPanel` | Visualização + botão reenfileirar |
| Android `beginTotemPaymentSession` | Totem usa sessão persistida no checkout |

### Estados da sessão

```
CREATED → PAYMENT_PENDING → AUTHORIZED → RELEASE_PENDING → RELEASED
                ↓              ↓
            EXPIRED    RECONCILIATION_PENDING → RECONCILED
                ↓              ↓
           CANCELLED      REVERSED / ERROR
```

### Cron reconcile-payments

Header: `x-cron-secret` = `RECONCILE_PAYMENTS_CRON_SECRET` (fallback: `AUTO_RELEASE_CRON_SECRET`)

Sugestão: executar a cada **2 minutos** via scheduler externo (pg_cron, GitHub Actions, etc.).

---

## Fase B — Stone POS (planejada)

1. Cadastrar terminal em `payment_terminals` (`provider = 'stone'`).
2. Implementar `StonePaymentAdapter` no Android (`PaymentProviderAdapter` em `src/lib/payments/types.ts`).
3. Reutilizar `begin_totem_payment_session` com `_provider = 'stone'`.
4. Edge function: consulta API Stone para reconciliação (análogo ao Order Manager Cielo).
5. Mesmo fluxo ESP: `enqueue_totem_machine_release` + pulso 1s.

---

## Fase C — ESP32 (planejada, sem mudar pulso)

- NVS para `lastExecutedCommandId` em firmware lavadora (já parcialmente no totem).
- Estado `RELEASE_PENDING` no metadata da sessão (já no backend).
- Poltrona: manter `timed_session` e `gpio_hold` atuais.

---

## Checklist operacional

- [ ] Aplicar migration `20260819120000_payment_sessions_cielo_reconcile.sql`
- [ ] Deploy edge function `reconcile-payments`
- [ ] Configurar cron com secret
- [ ] Instalar APK com `beginTotemPaymentSession` (após build)
- [ ] Monitorar painel Admin → Pagamentos
