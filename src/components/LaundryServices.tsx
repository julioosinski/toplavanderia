import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shirt, Droplets, Zap, Star, Clock, Euro } from "lucide-react";

const services = [
  {
    id: 1,
    title: "Lavado Standard",
    description: "Lavado completo de tu ropa con detergentes premium",
    icon: Droplets,
    price: "2.50",
    duration: "24-48h",
    features: ["Lavado a máquina", "Secado incluido", "Detergente premium"],
    popular: false
  },
  {
    id: 2,
    title: "Lavado Express",
    description: "Servicio rápido para cuando necesitas tu ropa urgente",
    icon: Clock,
    price: "4.00",
    duration: "24h",
    features: ["Lavado a máquina", "Secado rápido", "Servicio express"],
    popular: true
  },
  {
    id: 3,
    title: "Tintorería",
    description: "Limpieza en seco para prendas delicadas y formales",
    icon: Shirt,
    price: "8.00",
    duration: "48-72h",
    features: ["Limpieza en seco", "Prendas delicadas", "Tratamiento especial"],
    popular: false
  },
  {
    id: 4,
    title: "Planchado",
    description: "Planchado profesional para un acabado impecable",
    icon: Zap,
    price: "1.50",
    duration: "24h",
    features: ["Planchado profesional", "Acabado perfecto", "Prendas listas para usar"],
    popular: false
  }
];

const LaundryServices = () => {
  return (
    <section id="services" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Nuestros Servicios
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ofrecemos una amplia gama de servicios de lavandería adaptados a tus necesidades
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <Card 
                key={service.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-card hover:scale-105 ${
                  service.popular ? 'ring-2 ring-primary shadow-glow' : ''
                }`}
              >
                {service.popular && (
                  <Badge className="absolute top-4 right-4 bg-gradient-fresh text-white border-0">
                    <Star size={12} />
                    Popular
                  </Badge>
                )}
                
                <CardHeader className="text-center">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconComponent className="text-primary-foreground" size={24} />
                  </div>
                  <CardTitle className="text-xl text-foreground">{service.title}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {service.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center space-x-1">
                      <span className="text-3xl font-bold text-primary">{service.price}</span>
                      <Euro className="text-primary" size={20} />
                      <span className="text-muted-foreground">/kg</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tiempo: {service.duration}
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {service.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full" 
                    variant={service.popular ? "fresh" : "clean"}
                  >
                    Seleccionar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LaundryServices;