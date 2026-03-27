

# Sugestoes de Melhoria para o Sistema

Apos revisar o codigo atual, identifiquei as seguintes oportunidades de melhoria organizadas por area:

---

## 1. Totem — Experiencia do Usuario

### 1.1 Header dinamico com nome da lavanderia
O header mostra "Top Lavanderia" fixo. Deveria mostrar `currentLaundry.name` dinamicamente. O `TotemHeader` nao recebe essa prop.

**Acao:** Passar `laundryName` como prop para `TotemHeader` e exibir no lugar do texto fixo.

### 1.2 Indicador visual de "toque para selecionar"
Os cards de maquina disponiveis nao tem instrucao clara para o usuario. Adicionar uma mensagem entre o header e o grid: "Toque em uma maquina disponivel para iniciar".

### 1.3 Auto-reset apos sucesso
A tela de sucesso (`SuccessScreen`) depende do usuario clicar "Nova Transacao". Em um totem publico, deveria ter auto-reset apos 15-20 segundos com countdown visual.

### 1.4 Auto-reset apos erro
Mesma logica para `ErrorScreen` — auto-voltar para tela principal apos 30 segundos.

### 1.5 Animacao no status "running"
Maquinas em uso mostram um badge estatico. Adicionar uma animacao pulsante no indicador de status (o circulo verde/azul) para maquinas rodando, tornando mais claro visualmente.

### 1.6 Formatacao do CNPJ na tela de setup
O input aceita apenas numeros sem mascara. Adicionar mascara `XX.XXX.XXX/XXXX-XX` para facilitar a leitura.

---

## 2. Cards de Maquina — Visual

### 2.1 Icone de cadeado para maquinas em manutencao
Maquinas com status `maintenance` usam o mesmo icone da maquina. Adicionar um icone de cadeado/ferramenta sobreposto para diferenciar visualmente.

### 2.2 Remover botao "Selecionar" redundante
O card inteiro ja e clicavel. O botao "Selecionar" dentro do card ocupa espaco e e redundante. Remover o botao e usar o visual do card (borda, sombra, hover) como feedback de interacao.

---

## 3. Tela de Pagamento — Fluxo

### 3.1 Confirmacao antes do pagamento
Ao clicar em uma maquina, vai direto para pagamento. Adicionar um passo intermediario de confirmacao: "Voce selecionou Lavadora 01 — R$ 18,00 — 40 min. Confirmar?"

### 3.2 Tela de sucesso com dados da maquina
A `SuccessScreen` mostra `machine?.name` mas poderia ser mais visual — mostrar o icone da maquina, cor do tipo (azul/laranja), e uma estimativa de horario de termino.

---

## 4. Seguranca e Robustez

### 4.1 Gesto admin com feedback visual
Os gestos de 7 toques (footer e logo) nao dao nenhum feedback visual. Adicionar um contador discreto (ex: um pequeno ponto que aparece a cada toque apos o 3o) para que o tecnico saiba que esta funcionando.

### 4.2 Timeout na tela de pagamento
Se o usuario seleciona uma maquina e nao finaliza o pagamento, nao ha timeout. Adicionar auto-cancel apos 2 minutos de inatividade na `PaymentScreen`.

---

## 5. Dashboard Admin

### 5.1 Indicador de maquinas offline
O dashboard mostra "Disponiveis / Total" mas nao destaca maquinas offline ou em manutencao. Adicionar um card ou alerta quando ha maquinas com problemas.

### 5.2 Refresh automatico
O dashboard nao tem realtime subscription. Adicionar polling a cada 30s ou subscription para manter os dados atualizados sem reload manual.

---

## Resumo de Prioridades

| # | Melhoria | Impacto | Esforco |
|---|---|---|---|
| 1 | Auto-reset sucesso/erro (1.3, 1.4) | Alto | Baixo |
| 2 | Header dinamico com nome da lavanderia (1.1) | Medio | Baixo |
| 3 | Timeout na tela de pagamento (4.2) | Alto | Baixo |
| 4 | Confirmacao antes do pagamento (3.1) | Medio | Medio |
| 5 | Feedback visual no gesto admin (4.1) | Baixo | Baixo |
| 6 | Remover botao "Selecionar" redundante (2.2) | Baixo | Baixo |
| 7 | Instrucao "Toque para selecionar" (1.2) | Medio | Baixo |
| 8 | Animacao pulsante em maquinas rodando (2.1) | Baixo | Baixo |
| 9 | Mascara CNPJ (1.6) | Baixo | Baixo |
| 10 | Dashboard refresh automatico (5.2) | Medio | Medio |

## Arquivos a Modificar

| Arquivo | Melhorias |
|---|---|
| `TotemHeader.tsx` | Receber e exibir nome da lavanderia |
| `Totem.tsx` | Passar laundryName ao header, adicionar instrucao, timeout pagamento |
| `TotemPaymentScreens.tsx` | Auto-reset com countdown em SuccessScreen e ErrorScreen, confirmacao |
| `TotemMachineCard.tsx` | Remover botao, animacao pulsante, icone manutencao |
| `TotemCNPJSetup.tsx` | Mascara CNPJ formatada |
| `Dashboard.tsx` | Card de alertas, refresh automatico |

Deseja que eu implemente todas essas melhorias ou prefere selecionar algumas?

