import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  CreditCard,
  Activity,
  BarChart3,
  Monitor,
  ShieldCheck,
  Droplets,
  ArrowRight,
  CheckCircle2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: Cpu,
    title: "Controle de Máquinas",
    description:
      "Integração direta com ESP32 e BLE para acionamento remoto de lavadoras e secadoras.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos Integrados",
    description:
      "Aceite PIX, cartão de crédito e débito via TEF/PayGO diretamente no totem.",
  },
  {
    icon: Activity,
    title: "Monitoramento em Tempo Real",
    description:
      "Acompanhe o status de cada máquina, heartbeat dos dispositivos e alertas instantâneos.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e Gestão",
    description:
      "Dashboards completos com faturamento, uso por máquina e histórico de transações.",
  },
  {
    icon: Monitor,
    title: "Totem Self-Service",
    description:
      "Interface de autoatendimento para o cliente escolher a máquina, pagar e iniciar o ciclo.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança Avançada",
    description:
      "Row Level Security, auditoria de acessos, controle de roles e dispositivos autorizados.",
  },
];

const steps = [
  {
    number: "01",
    title: "Cadastre sua lavanderia",
    description:
      "Registre o CNPJ, configure os dados da empresa e convide operadores.",
  },
  {
    number: "02",
    title: "Configure as máquinas",
    description:
      "Adicione lavadoras e secadoras, conecte os ESP32 e defina preços e tempos de ciclo.",
  },
  {
    number: "03",
    title: "Comece a operar",
    description:
      "Ative o totem, aceite pagamentos e monitore tudo pelo painel administrativo.",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <Droplets className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight text-foreground">
              Top Lavanderia
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Como Funciona
            </a>
            <Link to="/totem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Totem
            </Link>
            <Link to="/auth">
              <Button size="sm">Entrar</Button>
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="flex flex-col gap-3 border-t border-border bg-background px-4 py-4 md:hidden">
            <a href="#funcionalidades" onClick={() => setMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
              Funcionalidades
            </a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
              Como Funciona
            </a>
            <Link to="/totem" className="text-sm text-muted-foreground hover:text-foreground">
              Totem
            </Link>
            <Link to="/auth">
              <Button size="sm" className="w-full">Entrar</Button>
            </Link>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-36">
        <div className="absolute inset-0 bg-gradient-clean opacity-60" />
        <div className="container relative mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4 text-xs uppercase tracking-wider">
            Plataforma completa de automação
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Automação inteligente para sua{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              lavanderia
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Gerencie máquinas, aceite pagamentos e monitore sua operação em
            tempo real — tudo em uma única plataforma conectada a hardware
            IoT.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                Acessar Painel <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/totem">
              <Button size="lg" variant="outline" className="gap-2">
                Conhecer Totem <Monitor className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Badge variant="outline" className="mb-3 text-xs uppercase tracking-wider">
              Funcionalidades
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Tudo que você precisa para operar
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Do hardware ao pagamento, cada detalhe foi pensado para
              lavanderias self-service modernas.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="group border border-border bg-card transition-shadow hover:shadow-card"
              >
                <CardContent className="flex flex-col gap-3 p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section id="como-funciona" className="border-t border-border bg-secondary/30 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Badge variant="outline" className="mb-3 text-xs uppercase tracking-wider">
              Como Funciona
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              3 passos para começar
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-10 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.number} className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {s.number}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Pronto para automatizar sua lavanderia?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Cadastre-se agora e comece a gerenciar suas máquinas com
            inteligência e praticidade.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" variant="fresh" className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Começar Agora
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Top Lavanderia</span>
          </div>
          <p>© {new Date().getFullYear()} Top Lavanderia. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/totem" className="hover:text-foreground transition-colors">Totem</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Login</Link>
            <Link to="/admin" className="hover:text-foreground transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
