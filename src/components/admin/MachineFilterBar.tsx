import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";

interface MachineFilterBarProps {
  statusFilter: string;
  typeFilter: string;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export const MachineFilterBar = ({
  statusFilter,
  typeFilter,
  onStatusChange,
  onTypeChange,
}: MachineFilterBarProps) => {
  return (
    <div className="flex items-center gap-2">
      <Filter size={16} className="text-muted-foreground" />
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Status</SelectItem>
          <SelectItem value="available">Disponíveis</SelectItem>
          <SelectItem value="running">Em Uso</SelectItem>
          <SelectItem value="offline">Offline</SelectItem>
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos Tipos</SelectItem>
          <SelectItem value="lavadora">Lavadoras</SelectItem>
          <SelectItem value="secadora">Secadoras</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
