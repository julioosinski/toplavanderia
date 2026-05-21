## Objetivo

Ao abrir o app na maquininha (Smart POS) ou totem, entrar automaticamente em **tela cheia bloqueada** (sem barra de status, sem botões do sistema, sem gestos do navegador). Apenas um **toque específico/secreto** libera o acesso às outras funções (admin, configurações, sair).

## Situação atual

O projeto já tem as peças, mas elas não estão "amarradas":

- `useKioskSecurity` — hook que faz fullscreen + bloqueia teclas/menu/contexto/back, mas só ativa quando alguém chama `enableSecurity()`.
- `useCapacitorIntegration` — esconde StatusBar e bloqueia botão back no Android nativo.
- Gestos administrativos no Totem — já existe o padrão de **7 toques no logo / footer** para abrir diagnóstico ou reconfigurar CNPJ.
- `useDeviceMode` — detecta `totem` / `smartpos` / `pwa`.

Hoje a tela cheia depende de interação manual e o app não esconde funções administrativas atrás do gesto.

## Plano

### 1. Ativar kiosk automaticamente ao abrir
- Em `src/pages/Totem.tsx` (e equivalente da Smart POS), chamar `enableSecurity()` no mount quando `isNative` ou `mode !== 'pwa'`.
- Em `useCapacitorIntegration`, já reforçar: `StatusBar.hide()`, immersive sticky, `keepScreenOn`. Garantir que rode na primeira renderização.
- Re-entrar em fullscreen automaticamente se o usuário sair (já existe em `handleFullscreenChange`, apenas precisa estar `securityEnabled=true`).
- PWA (navegador web admin) **não** entra em kiosk — segue normal.

### 2. Esconder acesso a outras funções
- Remover/ocultar no modo kiosk qualquer link visível para `/auth`, `/admin`, diagnóstico, etc.
- A UI do totem mostra apenas: seleção operação → máquinas → pagamento.

### 3. Gesto secreto para liberar
Padronizar **um único gesto** em vez dos múltiplos atuais. Sugestão:

- **7 toques rápidos no logo do header** (≤ 3s) → abre modal com PIN.
- PIN validado via `validate_admin_pin` (RPC já existente, fallback `1234`).
- Após PIN correto → menu com: "Área da equipe (/auth)", "Diagnóstico", "Reconfigurar CNPJ", "Sair do modo kiosk".

Implementação:
- Criar `src/components/totem/KioskUnlockGate.tsx` que envolve o header/logo, conta toques com debounce, abre `Dialog` com input PIN, e em sucesso renderiza um menu de ações.
- Reaproveitar `useAdminAccess` para validar o PIN.
- Ao escolher "Sair do modo kiosk" → `disableSecurity()` + navegar para `/auth`.

### 4. Limites técnicos a comunicar
- **Web fullscreen** (PWA no Chrome) pode ser cancelado pelo Android com swipe-down do sistema; mitigamos voltando ao fullscreen no `fullscreenchange`, mas não é 100% à prova de fuga.
- Para bloqueio real (sem barra de notificação, sem home), no APK Android é preciso **screen pinning / Lock Task Mode** ou um app launcher de kiosk (ex.: SureLock). Isso é config do dispositivo, fora do código React. Vou documentar isso em `DEPLOYMENT_TOTEM/README_TOTEM.md`.
- Na Cielo LIO / Smart POS, o app já roda como launcher quando configurado; o reforço por software aqui é suficiente.

## Arquivos a alterar

- `src/pages/Totem.tsx` — chamar `enableSecurity()` automaticamente no mount nativo; esconder atalhos administrativos.
- `src/components/totem/TotemHeader.tsx` — montar `KioskUnlockGate` no logo (substituir gestos atuais espalhados).
- `src/components/totem/KioskUnlockGate.tsx` *(novo)* — contador de toques + dialog PIN + menu de ações.
- `src/hooks/useKioskSecurity.ts` — pequeno ajuste para expor estado consistente e evitar loop ao desligar.
- `src/hooks/useCapacitorIntegration.ts` — garantir `StatusBar.hide()` e immersive logo na inicialização do totem.
- `DEPLOYMENT_TOTEM/README_TOTEM.md` — instruções de Screen Pinning / Lock Task Mode no Android para reforço extra.

## Perguntas antes de implementar

1. **Gesto secreto**: mantenho **7 toques no logo** (igual ao resto do app) ou prefere outro (ex.: pressionar 5s no canto, padrão de toques em 4 cantos)?
2. **PIN**: usa o PIN admin atual (RPC `validate_admin_pin`, fallback 1234) ou quer definir um PIN exclusivo de "destravar kiosk"?
3. **Botão "Área da equipe"** que existe hoje no rodapé do totem: removo (só acessível pelo gesto) ou mantenho visível?
