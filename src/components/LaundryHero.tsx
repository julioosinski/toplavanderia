import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Sparkles, Zap } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const LaundryHero = () => {
  return (
    <div className="min-h-screen bg-gradient-clean">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
              <Sparkles className="text-primary-foreground" size={20} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Top Lavandería</h1>
          </div>
          <div className="hidden md:flex space-x-6">
            <a href="#services" className="text-foreground hover:text-primary transition-smooth">Servicios</a>
            <a href="#pricing" className="text-foreground hover:text-primary transition-smooth">Precios</a>
            <a href="/totem" className="text-foreground hover:text-primary transition-smooth">Totem</a>
            <a href="/admin" className="text-foreground hover:text-primary transition-smooth">Admin</a>
            <a href="#contact" className="text-foreground hover:text-primary transition-smooth">Contacto</a>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl font-bold text-foreground leading-tight">
                Lavandería
                <span className="bg-gradient-primary bg-clip-text text-transparent"> Premium</span>
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Servicio de lavandería profesional con recogida y entrega a domicilio. 
                Cuidamos tu ropa como si fuera nuestra.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="fresh" size="lg" className="group">
                <Calendar className="group-hover:rotate-12 transition-all" />
                Reservar Ahora
              </Button>
              <Button variant="clean" size="lg">
                <Clock />
                Ver Precios
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-6 pt-8">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Zap className="text-primary" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Servicio Express</h3>
                  <p className="text-sm text-muted-foreground">En 24 horas</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                  <Sparkles className="text-accent" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Eco-Friendly</h3>
                  <p className="text-sm text-muted-foreground">Productos naturales</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <Card className="overflow-hidden shadow-card hover:shadow-glow transition-all duration-500">
              <img 
                src={heroImage} 
                alt="Servicio de lavandería profesional"
                className="w-full h-[400px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent"></div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LaundryHero;