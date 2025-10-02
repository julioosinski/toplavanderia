import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLaundry } from "@/contexts/LaundryContext";
import { useState } from "react";

export const LaundrySelector = () => {
  const { currentLaundry, laundries, isSuperAdmin, switchLaundry } = useLaundry();
  const [isChanging, setIsChanging] = useState(false);

  if (!isSuperAdmin || laundries.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="text-sm">
          {currentLaundry?.name || 'Carregando...'}
        </Badge>
      </div>
    );
  }

  const handleChange = async (value: string) => {
    setIsChanging(true);
    await switchLaundry(value);
    setIsChanging(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentLaundry?.id || ''}
        onValueChange={handleChange}
        disabled={isChanging}
      >
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Selecione a lavanderia" />
        </SelectTrigger>
        <SelectContent>
          {laundries.map((laundry) => (
            <SelectItem key={laundry.id} value={laundry.id}>
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                {laundry.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
