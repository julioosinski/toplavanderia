import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Settings, Phone, Mail, MapPin, Facebook, Instagram, Twitter } from "lucide-react";
import LaundryHero from "@/components/LaundryHero";
import LaundryServices from "@/components/LaundryServices";
import LaundryBooking from "@/components/LaundryBooking";

const Index = () => {
  return (
    <div className="min-h-screen">
      <div className="fixed top-4 right-4 z-50">
        <Button asChild variant="outline" size="sm" className="shadow-lg">
          <Link to="/auth">
            <Settings size={16} className="mr-2" />
            Admin
          </Link>
        </Button>
      </div>

      <LaundryHero />
      <LaundryServices />
      <LaundryBooking />

      {/* Footer */}
      <footer className="bg-secondary/20 border-t">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Top Lavanderia</h3>
              <p className="text-sm text-muted-foreground">
                Cuidado profissional para suas roupas com tecnologia de ponta.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>(11) 99999-9999</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>contato@toplavanderia.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>São Paulo, SP</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Links Úteis</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/services" className="hover:text-primary transition-colors">Serviços</Link></li>
                <li><Link to="/pricing" className="hover:text-primary transition-colors">Preços</Link></li>
                <li><Link to="/about" className="hover:text-primary transition-colors">Sobre Nós</Link></li>
                <li><Link to="/contact" className="hover:text-primary transition-colors">Contato</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Redes Sociais</h4>
              <div className="flex gap-4">
                <a href="#" className="hover:text-primary transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="hover:text-primary transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="hover:text-primary transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Top Lavanderia. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
