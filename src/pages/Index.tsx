import LaundryHero from "@/components/LaundryHero";
import LaundryServices from "@/components/LaundryServices";
import LaundryBooking from "@/components/LaundryBooking";

const Index = () => {
  return (
    <div className="min-h-screen">
      <LaundryHero />
      <LaundryServices />
      <LaundryBooking />
    </div>
  );
};

export default Index;
