

## Plano: Corrigir botão "Trocar Senha" no Admin

### Problema
O `PasswordChangeDialog` e usado como filho direto de `<DropdownMenuItem asChild>`, mas:
1. O componente nao aceita `ref` (erro no console: "Function components cannot be given refs")
2. O `Dialog` dentro do `DropdownMenuItem` conflita com o menu dropdown (ambos sao portais radix)

### Solucao

**Editar `src/layouts/AdminLayout.tsx`** (linhas 300-302):
- Remover o `<DropdownMenuItem asChild>` que envolve o `PasswordChangeDialog`
- Colocar o `PasswordChangeDialog` fora do `DropdownMenuContent`, controlado por estado local
- Dentro do dropdown, usar um `DropdownMenuItem` normal com `onClick` que abre o dialog

Abordagem concreta:
- Adicionar estado `passwordDialogOpen` no `AdminLayout`
- No dropdown, trocar por um `DropdownMenuItem` simples com `onClick={() => setPasswordDialogOpen(true)}`
- Renderizar `PasswordChangeDialog` fora do dropdown, passando `open` e `onOpenChange` como props

**Editar `src/components/admin/PasswordChangeDialog.tsx`**:
- Aceitar props `open` e `onOpenChange` para controle externo do Dialog
- Remover o `DialogTrigger` interno (o trigger vira o item do dropdown)

### Verificacao do login
O botao "Acessar Painel" na Home ja aponta para `/auth` corretamente. A rota `/auth` esta configurada em `App.tsx`. Nenhuma alteracao necessaria nesse fluxo.

