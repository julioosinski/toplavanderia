## Problema

O Dashboard mostra **2 máquinas disponíveis** (Lavadora 03 e Secadora 03), mas você confirma que **todos os ESP32s estão fisicamente desligados**.

No banco esses dois ainda estão com `is_online=true` e `last_heartbeat` recente (últimos minutos). A função `isEsp32Reachable` em `src/lib/machineEsp32Sync.ts` confia cegamente em `is_online=true` e **ignora a idade do heartbeat**:

```ts
// Servidor confirmou online — não usar relógio local
if (esp32.is_online === true) return true;
```

Resultado: enquanto a flag `is_online` no banco não for derrubada (cleanup só roda a cada 3 min), a UI segue contando como disponível mesmo sem heartbeat fresco. Se a flag ficar travada em `true` por bug do firmware/cleanup, a máquina nunca aparece offline.

## Correção

### 1. `src/lib/machineEsp32Sync.ts` — endurecer `isEsp32Reachable`

Sempre exigir heartbeat recente, independente de `is_online`. Manter a tolerância de skew de relógio (15 min) só para dispositivos com horário desajustado, mas **a janela de staleness passa a valer sempre**.

```ts
export function isEsp32Reachable(esp32, staleMs = ESP32_TOTEM_HEARTBEAT_STALE_MS): boolean {
  if (!esp32) return false;
  if (esp32.is_online === false) return false;
  const lastHb = esp32.last_heartbeat ? new Date(esp32.last_heartbeat) : null;
  if (!lastHb || Number.isNaN(lastHb.getTime())) return false;

  const now = Date.now();
  const maxSkew = 900_000; // 15 min de tolerância de relógio
  let ageMs = now - lastHb.getTime();
  if (ageMs < 0) ageMs = -ageMs > maxSkew ? Number.POSITIVE_INFINITY : 0;

  return ageMs <= staleMs; // <-- agora vale SEMPRE
}
```

### 2. Admin usa janela mais curta

No `computeMachineStatus` o Dashboard/admin já pode passar `staleMs` explicitamente. Vou adicionar uma constante `ESP32_ADMIN_HEARTBEAT_STALE_MS = 90_000` (1,5 min) e usá-la em:

- `src/hooks/useMachines.ts` → ao chamar `computeMachineStatus(machine, esp32, { staleMs: ESP32_ADMIN_HEARTBEAT_STALE_MS })` quando o consumidor não é totem (web/admin).
- `src/pages/admin/Dashboard.tsx` (`loadConsolidatedMachines`) idem.

Assim, máquina sem heartbeat há mais de 90 s no admin → cai para `offline` imediatamente, sem esperar o cleanup do banco (3 min).

### 3. Validação

Após o ajuste, com os dados atuais do banco:

- Lavadora 03 e Secadora 03 (heartbeat ~6 min atrás) → `offline`
- Card "Disponíveis" deve mostrar **0 / 9**
- Banner amarelo com contagem de offline aparece

Vou verificar abrindo o preview no `/admin` e confirmando o número.

## Fora de escopo

- Não vou mexer no firmware nem no cleanup do banco — só na lógica de exibição.
- Não vou alterar o totem (continua usando `ESP32_TOTEM_HEARTBEAT_STALE_MS = 42 s`, que já é mais agressivo).
