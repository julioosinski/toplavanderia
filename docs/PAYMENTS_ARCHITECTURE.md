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

## Fase B — Stone POS (em andamento)

### Já feito
- Opção **Stone POS** em Admin → Configurações → Provedor
- Campos: `stone_code`, `stone_app_key`, `stone_environment`, `stone_device_serial`
- Tabela `payment_terminals` + coluna `stone_transaction_id` em `payment_sessions`
- Contratos em `src/lib/payments/types.ts`

### Ainda falta
1. Implementar `StonePaymentManager` no Android (SDK Stone).
2. Flavor/APK Stone (ou mesmo app, conforme exigência da Stone).
3. Totem ler `paygo_provedor = stone` e usar o manager Stone.
4. Reconciliação Stone na edge `reconcile-payments`.
5. Homologação / instalação no POS Stone.

**Onde o usuário escolhe:** Admin da lavanderia em **Configurações → Provedor de Pagamento** (`paygo` | `cielo` | `stone`). O cliente no totem não escolhe o gateway.

---

## Fase C — ESP32 (planejada, sem mudar pulso)

- NVS para `lastExecutedCommandId` em firmware lavadora (já parcialmente no totem).
- Estado `RELEASE_PENDING` no metadata da sessão (já no backend).
- Poltrona: manter `timed_session` e `gpio_hold` atuais.

---

## Checklist operacional

- [x] Aplicar migration `20260819120000_payment_sessions_cielo_reconcile.sql`
- [x] Deploy edge function `reconcile-payments`
- [x] Secret `RECONCILE_PAYMENTS_CRON_SECRET` no projeto
- [x] Cron local `reconcile-payments-local` (pg_cron a cada 2 min) — `run_payment_reconcile_local()`
- [ ] Instalar APK `2.2.121` nas máquinas Cielo
- [ ] Validar no painel Admin → Pagamentos após 1–2 checkouts reais
- [ ] (Opcional) Chamar edge `reconcile-payments` com `x-cron-secret` para consultar Order Manager Cielo
