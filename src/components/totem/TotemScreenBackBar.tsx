import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TotemScreenBackBarProps {
  onBack: () => void;
  label?: string;
}

export const TotemScreenBackBar = ({ onBack, label = "Voltar" }: TotemScreenBackBarProps) => {
  return (
    <div className="flex items-center gap-1 px-2 py-2 border-b border-gray-100 bg-white shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 min-w-[44px] gap-2 text-base font-medium -ml-1"
        onClick={onBack}
      >
        <ArrowLeft className="h-6 w-6 shrink-0" />
        {label}
      </Button>
    </div>
  );
};
