import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLaundry } from "@/contexts/LaundryContext";

export const LaundrySelector = () => {
  const { currentLaundry, laundries, isSuperAdmin, switchLaundry } = useLaundry();

  if (!isSuperAdmin || laundries.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>{currentLaundry?.name || 'Carregando...'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentLaundry?.id || ''}
        onValueChange={switchLaundry}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Selecione a lavanderia" />
        </SelectTrigger>
        <SelectContent>
          {laundries.map((laundry) => (
            <SelectItem key={laundry.id} value={laundry.id}>
              {laundry.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
