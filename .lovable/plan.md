
# Totem + Maquininha Smart POS: Dois Modos de Operacao

## Entendimento

O sistema precisa suportar **dois cenarios de hardware**:

### Cenario A: Tablet/Monitor como Totem + Maquininha externa (PPC930)
- **Tela grande** (10"+ tablet ou monitor) mostra as maquinas e permite selecao
- **Maquininha separada** (PPC930 pinpad USB) faz a leitura do cartao e gera QR code PIX
- Ja e o cenario principal implementado hoje

### Cenario B: Maquininha Smart POS (tela 5-6" com touch)
- **Um unico dispositivo** serve como totem E como terminal de pagamento
- Tela menor (5-6"), precisa de layout adaptado
- Ja tem leitor de cartao, NFC e impressora termica integrados
- O PayGO roda nativamente no mesmo dispositivo

## O Que Precisa Mudar

### 1. Detectar tipo de dispositivo automaticamente
Criar hook `useDeviceMode` que detecta:
- **Tela grande (>= 8")**: Modo Totem classico (grid 6 colunas)
- **Tela pequena (< 8")**: Modo Smart POS (lista vertical, botoes maiores)

A deteccao usa a largura da tela (`window.innerWidth`). Smart POS tipicamente tem resolucao de ~720px de largura. Tablets tem 1024px+.

### 2. Layout adaptado para Smart POS (tela pequena)
Na tela principal do Totem:
- **Grid de maquinas**: trocar de 6 colunas para 2 colunas
- **Cards de maquinas**: maiores, com botoes de toque mais generosos
- **Header**: mais compacto, sem informacoes desnecessarias
- **Scroll vertical**: permitido (ao contrario do tablet que evita scroll)

Na tela de pagamento:
- Layout verticalizado, sem o widget lateral
- Botoes de credito/debito/PIX ocupam a tela inteira (facil de tocar)
- Feedback de processamento ocupa tela cheia

### 3. Modo Smart POS no UniversalPaymentWidget
Quando em modo Smart POS:
- Nao testar conexao "externa" (o pagamento e local no proprio dispositivo)
- Interface simplificada: apenas 3 botoes grandes (Credito, Debito, PIX)
- Sem selecao de "metodo" (PayGO/TEF) - sempre usa o PayGO nativo do dispositivo
- Feedback visual maior para o cliente ver de perto

### 4. PWA permanece somente visualizacao
Manter a estrategia definida: PWA (web) e somente admin/visualizacao, sem pagamentos.

## Detalhes Tecnicos

### Novo hook: `src/hooks/useDeviceMode.ts`
```text
Retorna:
- mode: 'totem' | 'smartpos' | 'pwa'
- screenSize: { width, height }
- isSmallScreen: boolean (< 800px)
- canProcessPayments: boolean (somente em Android nativo)
```

Logica:
- Se `!Capacitor.isNativePlatform()` -> modo 'pwa'
- Se nativo e `window.innerWidth < 800` -> modo 'smartpos'
- Se nativo e `window.innerWidth >= 800` -> modo 'totem'

### Modificar: `src/pages/Totem.tsx`
- Importar `useDeviceMode`
- Condicionar o grid de maquinas:
  - `totem`: grid-cols-6 (atual)
  - `smartpos`: grid-cols-2 com cards maiores e scroll vertical
  - `pwa`: grid sem botao "Selecionar" (view-only)
- Na tela de pagamento (`paymentStep === "payment"`):
  - `smartpos`: 3 botoes grandes (Credito/Debito/PIX) em tela cheia, sem o widget completo
  - `totem`: manter UniversalPaymentWidget atual

### Modificar: `src/components/payment/UniversalPaymentWidget.tsx`
- Receber prop `compactMode?: boolean`
- Quando `compactMode = true` (Smart POS):
  - Esconder secao "Metodos Disponiveis" (sempre PayGO nativo)
  - Botoes de tipo (credito/debito/PIX) ocupam mais espaco
  - Remover botao "Testar Conexoes"

### Modificar: `src/hooks/useUniversalPayment.ts`
- Em modo Smart POS, pular testes de TEF/PIX HTTP (tudo via plugin nativo)
- Forcar `paygo` como unico metodo disponivel

### Arquivos a criar/modificar:

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/hooks/useDeviceMode.ts` | Criar | Detecta totem vs smartpos vs pwa |
| `src/pages/Totem.tsx` | Modificar | Layout responsivo por modo |
| `src/components/payment/UniversalPaymentWidget.tsx` | Modificar | Adicionar compactMode |
| `src/hooks/useUniversalPayment.ts` | Modificar | Otimizar para Smart POS |

### Comportamento por modo:

```text
PWA (navegador):
  - Maquinas: visualizacao apenas (sem "Selecionar")
  - Pagamento: bloqueado
  - Admin: acesso completo

Totem (tablet/monitor Android):
  - Maquinas: grid 6 colunas, selecao habilitada
  - Pagamento: UniversalPaymentWidget completo (PayGO + TEF + PIX)
  - Pinpad externo via USB

Smart POS (maquininha Android):
  - Maquinas: grid 2 colunas, scroll vertical, botoes grandes
  - Pagamento: 3 botoes grandes (Credito/Debito/PIX) via PayGO nativo
  - Pagamento integrado no proprio dispositivo
```
