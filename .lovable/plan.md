

## Plano: Homepage + Reestruturação de Navegação

### Objetivo
Criar uma landing page institucional descrevendo a plataforma Top Lavanderia, com menu de navegação para as demais páginas (Totem, Login/Admin), e mover o login para `/auth` como segunda página acessível pelo menu.

### Arquivos a criar/editar

**1. Criar `src/pages/Home.tsx`** — Landing page com:
- **Header/Navbar** fixo com logo "Top Lavanderia", links: Início, Funcionalidades, Como Funciona, Totem, Login (botão destaque)
- **Hero Section**: título chamativo, subtítulo descrevendo automação de lavanderias, CTA "Acessar Painel" e "Conhecer Totem"
- **Seção Funcionalidades**: cards com ícones — Controle de Máquinas (ESP32/BLE), Pagamentos Integrados (PIX/TEF), Monitoramento em Tempo Real, Relatórios e Gestão, Totem Self-Service, Segurança e RLS
- **Seção Como Funciona**: 3 passos (Cadastre sua lavanderia → Configure as máquinas → Comece a operar)
- **Footer**: copyright, links úteis

**2. Editar `src/App.tsx`**:
- Rota `/` aponta para `<Home />` (em vez de redirect para `/totem`)
- Manter `/totem`, `/auth` e `/admin/*` como estão

### Design
- Reutilizar as variáveis CSS existentes (--primary, --accent, gradientes)
- Responsivo com Tailwind
- Componentes shadcn/ui existentes (Button, Card, Badge)
- Ícones lucide-react já disponíveis no projeto

