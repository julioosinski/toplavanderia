
# Gesto Secreto de 7 Toques no Logo para Reconfiguração de CNPJ

## O que será feito

Quando o totem já está configurado e funcionando, não há como trocar a lavanderia sem reinstalar o app. Vamos adicionar um **gesto secreto** — 7 toques rápidos no logo "Top Lavanderia" no header — que abre um diálogo de reconfiguração de CNPJ protegido por PIN, sem sair do modo kiosk nem reinstalar o APK.

## Fluxo do Gesto

```text
Usuário toca 7x no logo (em até 3 segundos)
         ↓
Vibração sutil de feedback (opcional via toast discreto)
         ↓
Abre diálogo: "🔧 Reconfiguração do Totem"
         ↓
   ┌─── Etapa 1: PIN ───┐
   │  Digite o PIN      │
   │  de administrador  │
   └────────────────────┘
         ↓ PIN correto
   ┌─── Etapa 2: CNPJ ──┐
   │  Novo CNPJ da      │
   │  lavanderia        │
   │  [______________]  │
   │  [Reconfigurar]    │
   └────────────────────┘
         ↓ CNPJ válido
Totem reinicia com nova lavanderia ✅
```

## Diferença do Gesto Existente

Já existe um gesto de 7 cliques no **texto do rodapé** (`"Sistema Online - Suporte..."`) que abre a configuração TEF. O novo gesto será no **ícone/logo do header** (`Sparkles` + `"Top Lavanderia"`), com propósito diferente: reconfigurar o CNPJ da lavanderia vinculada.

## Mudanças no Código

### Arquivo único: `src/pages/Totem.tsx`

#### 1. Novos estados (adicionar junto com os outros `useState`)

```typescript
// Gesto secreto no logo para reconfiguração
const [logoTapCount, setLogoTapCount] = useState(0);
const [showReconfigureDialog, setShowReconfigureDialog] = useState(false);
const [reconfigureStep, setReconfigureStep] = useState<'pin' | 'cnpj'>('pin');
const [reconfigurePin, setReconfigurePin] = useState('');
const [reconfigureCnpj, setReconfigureCnpj] = useState('');
const [reconfigureLoading, setReconfigureLoading] = useState(false);
const [reconfigureError, setReconfigureError] = useState('');
const [showReconfigurePin, setShowReconfigurePin] = useState(false);
```

#### 2. Nova função `handleLogoTap`

```typescript
const handleLogoTap = () => {
  const newCount = logoTapCount + 1;
  setLogoTapCount(newCount);

  if (newCount >= 7) {
    // Ativar diálogo de reconfiguração
    setShowReconfigureDialog(true);
    setReconfigureStep('pin');
    setReconfigurePin('');
    setReconfigureCnpj('');
    setReconfigureError('');
    setLogoTapCount(0);
  }

  // Reset contador após 3 segundos de inatividade
  setTimeout(() => setLogoTapCount(0), 3000);
};
```

#### 3. Função `handleReconfigurePin` (valida PIN com `validatePin`)

```typescript
const handleReconfigurePin = () => {
  const isValid = validatePin(reconfigurePin); // usando validatePin de useAdminAccess
  if (isValid) {
    setReconfigureStep('cnpj');
    setReconfigureError('');
    setReconfigurePin('');
  } else {
    setReconfigureError('PIN incorreto. Tente novamente.');
    setReconfigurePin('');
  }
};
```

#### 4. Função `handleReconfigureCNPJ` (limpa storage e reconfigura)

```typescript
const handleReconfigureCNPJ = async () => {
  const cleanCnpj = reconfigureCnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) {
    setReconfigureError('CNPJ deve ter 14 dígitos.');
    return;
  }
  setReconfigureLoading(true);
  setReconfigureError('');
  
  // Limpar storage atual antes de reconfigurar
  await nativeStorage.removeItem('totem_laundry_id');
  
  const success = await configureTotemByCNPJ(cleanCnpj);
  setReconfigureLoading(false);
  
  if (success) {
    setShowReconfigureDialog(false);
    toast({ title: "✅ Totem Reconfigurado", description: "Nova lavanderia carregada com sucesso." });
  } else {
    setReconfigureError('CNPJ não encontrado ou lavanderia inativa.');
  }
};
```

#### 5. Adicionar `validatePin` ao destructuring de `useAdminAccess`

```typescript
const { authenticate: adminAuthenticate, validatePin } = useAdminAccess();
```

#### 6. Adicionar `onClick={handleLogoTap}` ao `div` do logo no header

O `div` que contém o `Sparkles` e o `h1 "Top Lavanderia"` (linhas 578–587) receberá `onClick` e `select-none cursor-pointer`:

```tsx
<div 
  className="flex items-center space-x-2 select-none"
  onClick={handleLogoTap}
>
  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
    <Sparkles className="text-white" size={16} />
  </div>
  <div>
    <h1 className="text-lg font-bold text-white">Top Lavanderia</h1>
    ...
  </div>
</div>
```

#### 7. Adicionar o Dialog de reconfiguração antes do `</div>` final

Um `Dialog` do Radix (já importado via `@/components/ui/dialog`) com dois passos internos:

**Passo PIN:**
- Campo de senha com toggle mostrar/ocultar
- Botões "Confirmar" / "Cancelar"
- Máx. 3 tentativas (bloqueia e fecha o diálogo)

**Passo CNPJ:**
- Campo numérico com máscara visual (14 dígitos)
- Mostra nome da lavanderia atual como referência
- Botão "Reconfigurar Totem" com loading spinner
- Mensagem de erro em vermelho

#### 8. Importar `nativeStorage` no Totem.tsx

```typescript
import { nativeStorage } from '@/utils/nativeStorage';
```

Também importar `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription` de `@/components/ui/dialog`, e `Label` de `@/components/ui/label`, e `Eye, EyeOff, RefreshCw` de `lucide-react`.

## Segurança

- **PIN obrigatório** antes de qualquer reconfiguração — mesmo PIN do admin (`1234` em produção, configurável via `useAdminAccess`)
- **Máximo 3 tentativas** de PIN antes de fechar o diálogo automaticamente
- **Gesto invisível** — nenhum indicador visual de que o logo é clicável
- **Não interrompe o modo kiosk** — a segurança permanece ativa durante o processo
- O gesto exige **7 toques em até 3 segundos**, evitando ativação acidental

## Arquivo a modificar

- `src/pages/Totem.tsx` — único arquivo alterado
