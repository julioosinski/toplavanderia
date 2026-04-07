

## Plano: Revisão completa da integração Cielo no frontend e backend

### Problemas encontrados

1. **`as any` casts desnecessários no SettingsForm e Totem** — Os campos `cielo_client_id`, `cielo_access_token`, `cielo_merchant_code`, `cielo_environment` já existem na interface `SystemSettings`, mas o código usa `(localSettings as any).cielo_client_id`. Isso pode causar problemas de estado e auto-complete, e indica que os campos foram adicionados depois que o código foi escrito.

2. **Função `get_totem_settings` no banco não retorna campos Cielo** — A função SQL retorna apenas campos PayGo (`paygo_enabled`, `paygo_host`, etc.) mas não inclui `paygo_provedor`, `cielo_client_id`, `cielo_access_token`, `cielo_merchant_code`, `cielo_environment`. O edge function `totem-settings` chama essa RPC, então o totem Android nunca recebe as credenciais Cielo.

3. **Edge function `totem-settings`** — Usa a RPC `get_totem_settings` que está incompleta. Precisa ser atualizada.

4. **O formulário Cielo só aparece quando `paygo_provedor === 'cielo'`** — Isso é correto por design, mas o campo `paygo_provedor` é `null` no banco. O dropdown mostra "PayGo (padrão)" via fallback `|| 'paygo'`, mas o valor real é `null`, então ao mudar para "cielo" e salvar, funciona. Porém, se o usuário nunca selecionou explicitamente "cielo", a seção não aparece. Isso está funcionando como esperado.

### Alterações

#### 1. Atualizar `get_totem_settings` (migration SQL)

Adicionar os campos faltantes à função:
```sql
'paygo_provedor', paygo_provedor,
'cielo_client_id', cielo_client_id,
'cielo_access_token', cielo_access_token,
'cielo_merchant_code', cielo_merchant_code,
'cielo_environment', cielo_environment
```

#### 2. Remover casts `as any` no SettingsForm.tsx

Os campos Cielo já estão na interface `SystemSettings`. Trocar:
- `(localSettings as any).cielo_client_id` → `localSettings.cielo_client_id`
- `updateSetting('cielo_client_id' as any, ...)` → `updateSetting('cielo_client_id', ...)`
- Idem para `cielo_access_token`, `cielo_merchant_code`, `cielo_environment`

#### 3. Remover casts `as any` no Totem.tsx

Trocar:
- `(systemSettings as any)?.cielo_client_id` → `systemSettings?.cielo_client_id`
- Idem para os outros campos Cielo

#### 4. Atualizar edge function `totem-settings`

Opção: além de usar a RPC, pode fazer query direta para incluir todos os campos. Mas como a RPC é a fonte, a migration no passo 1 resolve.

### Resumo

| Arquivo | Ação |
|---|---|
| Migration SQL | Atualizar `get_totem_settings` para incluir campos Cielo |
| `SettingsForm.tsx` | Remover `as any` dos campos Cielo |
| `Totem.tsx` | Remover `as any` dos campos Cielo |

Estas correções garantem que:
- O formulário Cielo funciona com tipagem correta
- O totem Android recebe as credenciais Cielo via edge function
- Tudo é consistente entre frontend, backend e banco

