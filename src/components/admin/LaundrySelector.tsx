import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLaundry } from "@/hooks/useLaundry";
import { useState } from "react";

export const LaundrySelector = () => {
  const {
    currentLaundry,
    laundries,
    isSuperAdmin,
    switchLaundry,
    switchToAllLaundries,
    isViewingAllLaundries,
  } = useLaundry();
  const [isChanging, setIsChanging] = useState(false);

  if (!isSuperAdmin || laundries.length <= 1) {
    return (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Badge variant="outline" className="text-sm max-w-[200px] truncate">
          {currentLaundry?.name || "Carregando..."}
        </Badge>
      </div>
    );
  }

  const handleChange = async (value: string) => {
    setIsChanging(true);
    try {
      if (value === "all") {
        await switchToAllLaundries();
      } else {
        await switchLaundry(value);
      }
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={isViewingAllLaundries ? "all" : currentLaundry?.id || ""}
        onValueChange={(v) => void handleChange(v)}
        disabled={isChanging}
      >
        <SelectTrigger className="w-[min(100vw-8rem,260px)]">
          <SelectValue placeholder="Lavanderia" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              Todas (visão consolidada)
            </div>
          </SelectItem>
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
