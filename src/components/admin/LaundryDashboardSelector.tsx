import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLaundry } from "@/contexts/LaundryContext";
import { Building2 } from "lucide-react";

export const LaundryDashboardSelector = () => {
  const { currentLaundry, laundries, isSuperAdmin, switchLaundry } = useLaundry();

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Building2 size={16} />
        <span className="text-sm font-medium">{currentLaundry?.name}</span>
      </div>
    );
  }

  return (
    <Select
      value={currentLaundry?.id || "all"}
      onValueChange={(value) => {
        if (value !== "all") {
          switchLaundry(value);
        } else {
          // Set to "all" mode - store in localStorage
          localStorage.setItem('selectedLaundryId', 'all');
          window.location.reload(); // Refresh to load all data
        }
      }}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Selecione uma lavanderia" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <Building2 size={14} />
            <span>Todas as Lavanderias</span>
          </div>
        </SelectItem>
        {laundries.map((laundry) => (
          <SelectItem key={laundry.id} value={laundry.id}>
            {laundry.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
