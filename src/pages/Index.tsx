import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import LaundryHero from "@/components/LaundryHero";
import LaundryServices from "@/components/LaundryServices";
import LaundryBooking from "@/components/LaundryBooking";

const Index = () => {
  return (
    <div className="min-h-screen">
      <div className="fixed top-4 right-4 z-50">
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">
            <Settings size={16} className="mr-2" />
            Admin
          </Link>
        </Button>
      </div>
      <LaundryHero />
      <LaundryServices />
      <LaundryBooking />
    </div>
  );
};

export default Index;
