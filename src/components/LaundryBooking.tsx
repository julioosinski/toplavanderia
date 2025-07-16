import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, MapPin, Phone, User, Package, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const LaundryBooking = () => {
  const [date, setDate] = useState<Date>();
  const [timeSlot, setTimeSlot] = useState("");
  const [service, setService] = useState("");
  const [weight, setWeight] = useState("");
  const { toast } = useToast();

  const timeSlots = [
    "09:00 - 11:00",
    "11:00 - 13:00", 
    "13:00 - 15:00",
    "15:00 - 17:00",
    "17:00 - 19:00"
  ];

  const services = [
    { value: "standard", label: "Lavado Standard (2.50€/kg)", duration: "24-48h" },
    { value: "express", label: "Lavado Express (4.00€/kg)", duration: "24h" },
    { value: "dry-cleaning", label: "Tintorería (8.00€/kg)", duration: "48-72h" },
    { value: "ironing", label: "Planchado (1.50€/kg)", duration: "24h" }
  ];

  const calculatePrice = () => {
    const prices = {
      standard: 2.50,
      express: 4.00,
      "dry-cleaning": 8.00,
      ironing: 1.50
    };
    
    const servicePrice = prices[service as keyof typeof prices] || 0;
    const weightNum = parseFloat(weight) || 0;
    return (servicePrice * weightNum).toFixed(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "¡Reserva confirmada!",
      description: `Tu pedido ha sido programado para el ${date ? format(date, "PPP", { locale: es }) : ""} de ${timeSlot}`,
    });
  };

  return (
    <section id="booking" className="py-20 bg-gradient-clean">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Reserva tu Servicio
            </h2>
            <p className="text-xl text-muted-foreground">
              Programa la recogida de tu ropa en unos simples pasos
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Booking Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="text-primary" />
                    <span>Detalles del Servicio</span>
                  </CardTitle>
                  <CardDescription>
                    Completa la información para tu reserva
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Personal Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="flex items-center space-x-2">
                          <User size={16} />
                          <span>Nombre completo</span>
                        </Label>
                        <Input id="name" placeholder="Tu nombre" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center space-x-2">
                          <Phone size={16} />
                          <span>Teléfono</span>
                        </Label>
                        <Input id="phone" type="tel" placeholder="+34 600 000 000" required />
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label htmlFor="address" className="flex items-center space-x-2">
                        <MapPin size={16} />
                        <span>Dirección de recogida</span>
                      </Label>
                      <Textarea 
                        id="address" 
                        placeholder="Calle, número, piso, ciudad, código postal"
                        required 
                      />
                    </div>

                    {/* Service Selection */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de servicio</Label>
                        <Select value={service} onValueChange={setService} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un servicio" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <div className="flex flex-col">
                                  <span>{s.label}</span>
                                  <span className="text-xs text-muted-foreground">{s.duration}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight">Peso estimado (kg)</Label>
                        <Input 
                          id="weight" 
                          type="number" 
                          step="0.5"
                          min="1"
                          placeholder="5"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          required 
                        />
                      </div>
                    </div>

                    {/* Date and Time */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fecha de recogida</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="clean"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {date ? format(date, "PPP", { locale: es }) : "Selecciona una fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={date}
                              onSelect={setDate}
                              disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Franja horaria</Label>
                        <Select value={timeSlot} onValueChange={setTimeSlot} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona horario" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot} value={slot}>
                                <div className="flex items-center space-x-2">
                                  <Clock size={16} />
                                  <span>{slot}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button type="submit" variant="fresh" size="lg" className="w-full">
                      Confirmar Reserva
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <div className="space-y-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Resumen del Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {service && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Servicio:</span>
                        <Badge variant="secondary">
                          {services.find(s => s.value === service)?.label.split(' (')[0]}
                        </Badge>
                      </div>
                      {weight && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Peso:</span>
                            <span className="font-medium">{weight} kg</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold border-t pt-2">
                            <span>Total:</span>
                            <span className="text-primary">{calculatePrice()}€</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {date && timeSlot && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold mb-2">Recogida programada:</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(date, "PPP", { locale: es })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {timeSlot}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardContent className="pt-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-gradient-fresh rounded-full flex items-center justify-center mx-auto">
                      <Clock className="text-white" size={20} />
                    </div>
                    <h4 className="font-semibold">Servicio Express</h4>
                    <p className="text-sm text-muted-foreground">
                      Recogida y entrega el mismo día por solo 2€ extra
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LaundryBooking;